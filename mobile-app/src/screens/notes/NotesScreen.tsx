import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NavigationBar } from '../../components/NavigationBar';
import { QatarColors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToastContext } from '../../contexts/ToastContext';
import { useLoadingOverlay } from '../../contexts/LoadingOverlayContext';
import { NotesStackNavigationProp } from '../../types/navigation';

interface Note {
  id: string;
  title: string;
  content: string;
  created_at: string;
  created_by: string;
}

interface PanelInfo {
  id: string;
  name: string;
  facade_name?: string;
}

interface PanelGroup {
  id: string;
  name: string;
  description: string;
  project_id: string;
  project_name: string;
  panels: PanelInfo[];
}

interface NoteWithPanelGroups extends Note {
  panel_groups: PanelGroup[];
}

export default function NotesScreen() {
  const [notes, setNotes] = useState<NoteWithPanelGroups[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { showToast } = useToastContext();
  const { showLoadingOverlay } = useLoadingOverlay();
  const navigation = useNavigation<NotesStackNavigationProp>();

  const filteredNotes = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return notes;

    return notes.filter(note => {
      if (note.title.toLowerCase().includes(query)) return true;
      if (note.content?.toLowerCase().includes(query)) return true;

      for (const group of note.panel_groups) {
        if (group.name.toLowerCase().includes(query)) return true;
        for (const panel of group.panels) {
          if (panel.name.toLowerCase().includes(query)) return true;
          if (panel.facade_name?.toLowerCase().includes(query)) return true;
        }
      }

      return false;
    });
  }, [notes, searchTerm]);

  useEffect(() => {
    fetchNotes();
  }, []);

  const fetchNotes = async () => {
    try {
      const { data: notesData, error: notesError } = await supabase
        .from('notes')
        .select('*')
        .order('created_at', { ascending: false });

      if (notesError) throw notesError;

      // Fetch panel groups for each note
      const notesWithPanelGroups = await Promise.all(
        notesData.map(async (note) => {
          // First get the panel group IDs for this note
          const { data: notePanelGroupsData, error: notePanelGroupsError } = await supabase
            .from('note_panel_groups')
            .select('panel_group_id')
            .eq('note_id', note.id);

          if (notePanelGroupsError) throw notePanelGroupsError;

          if (!notePanelGroupsData || notePanelGroupsData.length === 0) {
            return {
              ...note,
              panel_groups: [] as PanelGroup[]
            };
          }

          // Get the panel group details
          const panelGroupIds = notePanelGroupsData.map(item => item.panel_group_id);
          const { data: panelGroupsData, error: panelGroupsError } = await supabase
            .from('panel_groups')
            .select('id, name, description, project_id')
            .in('id', panelGroupIds);

          if (panelGroupsError) throw panelGroupsError;

          // Get project names
          const projectIds = panelGroupsData?.map(item => item.project_id).filter(Boolean) || [];
          const { data: projectsData, error: projectsError } = await supabase
            .from('projects')
            .select('id, name')
            .in('id', projectIds);

          if (projectsError) throw projectsError;

          const projectsMap = new Map(projectsData?.map(p => [p.id, p.name]) || []);

          // Fetch panels for these panel groups via memberships
          const { data: membershipsData } = await supabase
            .from('panel_group_memberships')
            .select('panel_group_id, panel_id')
            .in('panel_group_id', panelGroupIds);

          const allPanelIds = membershipsData?.map(m => m.panel_id) || [];
          let panelsMap = new Map<string, PanelInfo[]>();

          if (allPanelIds.length > 0) {
            const { data: panelsData } = await supabase
              .from('panels')
              .select('id, name, facade:facades(name)')
              .in('id', allPanelIds);

            // Group panels by panel_group_id
            for (const membership of membershipsData || []) {
              const panel = panelsData?.find((p: any) => p.id === membership.panel_id);
              if (panel) {
                const groupPanels = panelsMap.get(membership.panel_group_id) || [];
                groupPanels.push({
                  id: panel.id,
                  name: panel.name || `Panel ${panel.id.slice(0, 8)}`,
                  facade_name: (panel.facade as any)?.name,
                });
                panelsMap.set(membership.panel_group_id, groupPanels);
              }
            }
          }

          const panelGroups: PanelGroup[] = panelGroupsData?.map((item: any) => ({
            id: item.id,
            name: item.name,
            description: item.description,
            project_id: item.project_id,
            project_name: projectsMap.get(item.project_id) || 'Unknown Project',
            panels: panelsMap.get(item.id) || [],
          })) || [];

          return {
            ...note,
            panel_groups: panelGroups
          };
        })
      );

      setNotes(notesWithPanelGroups);
    } catch (error) {
      console.error('Error fetching notes:', error);
      showToast('Error fetching notes', 'error');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchNotes();
    setRefreshing(false);
  };

  const openNoteDetail = useCallback((note: NoteWithPanelGroups) => {
    showLoadingOverlay();
    navigation.navigate('NoteDetails', { noteId: note.id });
  }, [showLoadingOverlay, navigation]);

  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);

  const renderNoteItem = useCallback(({ item }: { item: NoteWithPanelGroups }) => (
    <TouchableOpacity
      style={styles.noteCard}
      onPress={() => openNoteDetail(item)}
      activeOpacity={0.7}
    >
      <View style={styles.noteHeader}>
        <View style={styles.noteTitleContainer}>
          <Ionicons name="document-text-outline" size={20} color={QatarColors.primary} />
          <Text style={styles.noteTitle} numberOfLines={1}>
            {item.title}
          </Text>
        </View>
        <Text style={styles.noteId}>NT-{item.id.slice(-4).toUpperCase()}</Text>
      </View>

      {item.content ? (
        <Text style={styles.noteContentPreview} numberOfLines={2}>
          {item.content}
        </Text>
      ) : (
        <Text style={styles.noteContentEmpty}>No content</Text>
      )}

      {item.panel_groups.length > 0 && (
        <View style={styles.panelGroupsContainer}>
          <Text style={styles.panelGroupsLabel}>
            {item.panel_groups.length} Panel Group{item.panel_groups.length !== 1 ? 's' : ''}
          </Text>
          <View style={styles.panelGroupsBadges}>
            {item.panel_groups.slice(0, 2).map((group) => (
              <View key={group.id} style={styles.panelGroupBadge}>
                <Text style={styles.panelGroupBadgeText} numberOfLines={1}>
                  {group.name}
                </Text>
              </View>
            ))}
            {item.panel_groups.length > 2 && (
              <Text style={styles.moreGroupsText}>
                +{item.panel_groups.length - 2} more
              </Text>
            )}
          </View>
        </View>
      )}

      <View style={styles.noteFooter}>
        <Text style={styles.noteDate}>
          {formatDate(item.created_at)}
        </Text>
      </View>
    </TouchableOpacity>
  ), [openNoteDetail, formatDate]);

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="document-text-outline" size={64} color={QatarColors.mutedForeground} />
      <Text style={styles.emptyTitle}>No Notes Found</Text>
      <Text style={styles.emptySubtitle}>
        Notes will appear here when they are created
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <NavigationBar title="Notes" showBackButton={false} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={QatarColors.primary} />
          <Text style={styles.loadingText}>Loading notes...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <NavigationBar title="Notes" showBackButton={false} />

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={QatarColors.mutedForeground} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by note, panel, or facade..."
          placeholderTextColor={QatarColors.mutedForeground}
          value={searchTerm}
          onChangeText={setSearchTerm}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {searchTerm.length > 0 && (
          <TouchableOpacity onPress={() => setSearchTerm('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={18} color={QatarColors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>

      {filteredNotes.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[QatarColors.primary]}
            />
          }
        >
          {searchTerm.trim() ? (
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={64} color={QatarColors.mutedForeground} />
              <Text style={styles.emptyTitle}>No Results Found</Text>
              <Text style={styles.emptySubtitle}>
                No notes match "{searchTerm}"
              </Text>
              <TouchableOpacity style={styles.clearSearchButton} onPress={() => setSearchTerm('')}>
                <Text style={styles.clearSearchButtonText}>Clear Search</Text>
              </TouchableOpacity>
            </View>
          ) : (
            renderEmptyState()
          )}
        </ScrollView>
      ) : (
        <FlatList
          data={filteredNotes}
          keyExtractor={(item) => item.id}
          renderItem={renderNoteItem}
          contentContainerStyle={styles.listContainer}
          initialNumToRender={10}
          maxToRenderPerBatch={8}
          windowSize={10}
          removeClippedSubviews={true}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[QatarColors.primary]}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: QatarColors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: QatarColors.mutedForeground,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: QatarColors.input,
    borderRadius: 8,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: QatarColors.border,
    height: 42,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: QatarColors.foreground,
    height: '100%',
    padding: 0,
  },
  clearSearchButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: QatarColors.primary,
    borderRadius: 8,
  },
  clearSearchButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollContent: {
    flexGrow: 1,
  },
  listContainer: {
    padding: 16,
  },
  noteCard: {
    backgroundColor: QatarColors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    shadowColor: QatarColors.foreground,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    borderWidth: 1,
    borderColor: QatarColors.border,
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  noteTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  noteTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: QatarColors.foreground,
    flex: 1,
  },
  noteId: {
    fontSize: 10,
    color: QatarColors.mutedForeground,
    fontWeight: '500',
  },
  noteContentPreview: {
    fontSize: 12,
    color: QatarColors.foreground,
    marginBottom: 10,
    lineHeight: 18,
  },
  noteContentEmpty: {
    fontSize: 12,
    color: QatarColors.mutedForeground,
    fontStyle: 'italic',
    marginBottom: 10,
  },
  panelGroupsContainer: {
    marginBottom: 12,
  },
  panelGroupsLabel: {
    fontSize: 11,
    color: QatarColors.mutedForeground,
    marginBottom: 6,
    fontWeight: '500',
  },
  panelGroupsBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  panelGroupBadge: {
    backgroundColor: QatarColors.primary + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: QatarColors.primary + '40',
  },
  panelGroupBadgeText: {
    fontSize: 11,
    color: QatarColors.primary,
    fontWeight: '500',
  },
  moreGroupsText: {
    fontSize: 11,
    color: QatarColors.mutedForeground,
    alignSelf: 'center',
  },
  noteFooter: {
    borderTopWidth: 1,
    borderTopColor: QatarColors.border,
    paddingTop: 8,
  },
  noteDate: {
    fontSize: 11,
    color: QatarColors.mutedForeground,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: QatarColors.foreground,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: QatarColors.mutedForeground,
    textAlign: 'center',
    lineHeight: 24,
  },
});
