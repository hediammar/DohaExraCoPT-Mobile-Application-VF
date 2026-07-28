import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Plus, Edit, Trash2, FileText } from 'lucide-react';
import { useToastContext } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { hasPermission, UserRole } from '../utils/rolePermissions';

interface Note {
  id: string;
  title: string;
  content: string;
  created_at: string;
  created_by: string;
}

interface PanelGroup {
  id: string;
  name: string;
  description: string;
  project_id: string;
  project_name: string;
}

interface NoteWithPanelGroups extends Note {
  panel_groups: PanelGroup[];
}

const NotesPage: React.FC = () => {
  const navigate = useNavigate();
  const [notes, setNotes] = useState<NoteWithPanelGroups[]>([]);
  const [panelGroups, setPanelGroups] = useState<PanelGroup[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState<NoteWithPanelGroups | null>(null);
  const [newNote, setNewNote] = useState({ title: '', content: '' });
  const [selectedPanelGroups, setSelectedPanelGroups] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const { showToast } = useToastContext();
  const { user: currentUser } = useAuth();

  // RBAC Permission checks
  const canCreateNotes = currentUser?.role ? hasPermission(currentUser.role as UserRole, 'notes', 'canCreate') : false;
  const canUpdateNotes = currentUser?.role ? hasPermission(currentUser.role as UserRole, 'notes', 'canUpdate') : false;
  const canDeleteNotes = currentUser?.role ? hasPermission(currentUser.role as UserRole, 'notes', 'canDelete') : false;

  useEffect(() => {
    fetchNotes();
    fetchPanelGroups();
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
              panel_groups: []
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

          const panelGroups: PanelGroup[] = panelGroupsData?.map((item: any) => ({
            id: item.id,
            name: item.name,
            description: item.description,
            project_id: item.project_id,
            project_name: projectsMap.get(item.project_id) || 'Unknown Project'
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
    }
  };

  const fetchPanelGroups = async () => {
    try {
      const { data, error } = await supabase
        .from('panel_groups')
        .select(`
          id,
          name,
          description,
          project_id
        `)
        .order('name');

      if (error) throw error;

      // Fetch project names separately
      const projectIds = Array.from(new Set(data.map(item => item.project_id).filter(Boolean)));
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('id, name')
        .in('id', projectIds);

      if (projectsError) throw projectsError;

      const projectsMap = new Map(projectsData?.map(p => [p.id, p.name]) || []);

      const formattedData = data.map(item => ({
        id: item.id,
        name: item.name,
        description: item.description,
        project_id: item.project_id,
        project_name: projectsMap.get(item.project_id) || 'Unknown Project'
      }));

      setPanelGroups(formattedData);
    } catch (error) {
      console.error('Error fetching panel groups:', error);
      showToast('Error fetching panel groups', 'error');
    }
  };

  const handleCreateNote = async () => {
    if (isCreating) {
      return; // Prevent double-clicking
    }

    if (!newNote.title.trim()) {
      showToast('Note title is required', 'error');
      return;
    }

    setIsCreating(true);
    try {
      // Create the note
      const { data: noteData, error: noteError } = await supabase
        .from('notes')
        .insert([newNote])
        .select()
        .single();

      if (noteError) throw noteError;

      // Add panel groups to the note if any are selected
      if (selectedPanelGroups.length > 0) {
        const notePanelGroups = selectedPanelGroups.map(panelGroupId => ({
          note_id: noteData.id,
          panel_group_id: panelGroupId
        }));

        const { error: addGroupsError } = await supabase
          .from('note_panel_groups')
          .insert(notePanelGroups);

        if (addGroupsError) throw addGroupsError;
      }

      showToast('Note created successfully', 'success');
      setIsCreateDialogOpen(false);
      setNewNote({ title: '', content: '' });
      setSelectedPanelGroups([]);
      fetchNotes();
    } catch (error) {
      console.error('Error creating note:', error);
      showToast('Error creating note', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleEditNote = async () => {
    if (!selectedNote || !selectedNote.title.trim()) {
      showToast('Note title is required', 'error');
      return;
    }

    try {
      // Update the note
      const { error: noteError } = await supabase
        .from('notes')
        .update({
          title: selectedNote.title,
          content: selectedNote.content
        })
        .eq('id', selectedNote.id);

      if (noteError) throw noteError;

      // Remove all existing panel groups and add the new selection
      const { error: removeError } = await supabase
        .from('note_panel_groups')
        .delete()
        .eq('note_id', selectedNote.id);

      if (removeError) throw removeError;

      // Add new panel groups if any are selected
      if (selectedPanelGroups.length > 0) {
        const notePanelGroups = selectedPanelGroups.map(panelGroupId => ({
          note_id: selectedNote.id,
          panel_group_id: panelGroupId
        }));

        const { error: addGroupsError } = await supabase
          .from('note_panel_groups')
          .insert(notePanelGroups);

        if (addGroupsError) throw addGroupsError;
      }

      showToast('Note updated successfully', 'success');
      setIsEditDialogOpen(false);
      setSelectedNote(null);
      setSelectedPanelGroups([]);
      fetchNotes();
    } catch (error) {
      console.error('Error updating note:', error);
      showToast('Error updating note', 'error');
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!window.confirm('Are you sure you want to delete this note?')) return;

    try {
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', noteId);

      if (error) throw error;

      showToast('Note deleted successfully', 'success');
      fetchNotes();
    } catch (error) {
      console.error('Error deleting note:', error);
      showToast('Error deleting note', 'error');
    }
  };

  const openEditDialog = (note: NoteWithPanelGroups) => {
    setSelectedNote(note);
    setSelectedPanelGroups(note.panel_groups.map(pg => pg.id));
    setIsEditDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Notes</h2>
          <Badge variant="secondary" className="ml-2">
            {notes.length}
          </Badge>
        </div>
        {canCreateNotes && (
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create Note
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Note</DialogTitle>
              <DialogDescription>
                Create a note and optionally group panel groups under it.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={newNote.title}
                  onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
                  placeholder="Enter note title"
                />
              </div>
              <div>
                <Label htmlFor="content">Content</Label>
                <Textarea
                  id="content"
                  value={newNote.content}
                  onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
                  placeholder="Enter note content"
                  rows={4}
                />
              </div>
              <div>
                <Label>Panel Groups (Optional)</Label>
                <Select
                  value=""
                  onValueChange={(value) => {
                    if (value && !selectedPanelGroups.includes(value)) {
                      setSelectedPanelGroups([...selectedPanelGroups, value]);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select panel groups to add" />
                  </SelectTrigger>
                  <SelectContent>
                    {panelGroups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name} - {group.project_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedPanelGroups.length > 0 && (
                  <div className="mt-2 space-y-2">
                    <Label>Selected Panel Groups:</Label>
                    <div className="flex flex-wrap gap-2">
                      {selectedPanelGroups.map((groupId) => {
                        const group = panelGroups.find(g => g.id === groupId);
                        return (
                          <Badge
                            key={groupId}
                            variant="secondary"
                            className="cursor-pointer"
                            onClick={() => setSelectedPanelGroups(selectedPanelGroups.filter(id => id !== groupId))}
                          >
                            {group?.name} - {group?.project_name}
                            <span className="ml-1">×</span>
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateNote}
                  disabled={isCreating}
                >
                  {isCreating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Creating...
                    </>
                  ) : (
                    'Create Note'
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        )}
      </div>

      {/* Notes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {notes.map((note) => (
          <Card
            key={note.id}
            className="qatar-card flex flex-col justify-between cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => navigate(`/notes/${note.id}`)}
          >
            <CardHeader className="qatar-card-header">
              <div>
                <CardTitle className="qatar-card-title">
                  {note.title}
                </CardTitle>
                <p className="qatar-card-subtitle">
                  NT-{note.id.slice(-4).toUpperCase()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {note.panel_groups.length} groups
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="qatar-card-content">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-card-foreground font-medium">
                    {note.content ? 'Has content' : 'No content'}
                  </span>
                </div>

                {note.panel_groups.length > 0 && (
                  <div>
                    <Label className="text-sm font-medium">Panel Groups:</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {note.panel_groups.slice(0, 3).map((group) => (
                        <Badge key={group.id} variant="outline" className="text-xs">
                          {group.name}
                          {group.project_name && ` (${group.project_name})`}
                        </Badge>
                      ))}
                      {note.panel_groups.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{note.panel_groups.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="qatar-card-footer">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">
                    Created: {new Date(note.created_at).toLocaleDateString()}
                  </div>
                  <div className="flex gap-2">
                    {canUpdateNotes && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditDialog(note);
                        }}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                    )}
                    {canDeleteNotes && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteNote(note.id);
                        }}
                        className="border-red-400/50 text-red-400 hover:bg-red-400/10"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {notes.length === 0 && (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No notes found</h3>
          <p className="text-muted-foreground mb-4">
            Get started by adding your first note
          </p>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create Note
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Note</DialogTitle>
                <DialogDescription>
                  Create a note and optionally group panel groups under it.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={newNote.title}
                    onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
                    placeholder="Enter note title"
                  />
                </div>
                <div>
                  <Label htmlFor="content">Content</Label>
                  <Textarea
                    id="content"
                    value={newNote.content}
                    onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
                    placeholder="Enter note content"
                    rows={4}
                  />
                </div>
                <div>
                  <Label>Panel Groups (Optional)</Label>
                  <Select
                    value=""
                    onValueChange={(value) => {
                      if (value && !selectedPanelGroups.includes(value)) {
                        setSelectedPanelGroups([...selectedPanelGroups, value]);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select panel groups to add" />
                    </SelectTrigger>
                    <SelectContent>
                      {panelGroups.map((group) => (
                        <SelectItem key={group.id} value={group.id}>
                          {group.name} - {group.project_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedPanelGroups.length > 0 && (
                    <div className="mt-2 space-y-2">
                      <Label>Selected Panel Groups:</Label>
                      <div className="flex flex-wrap gap-2">
                        {selectedPanelGroups.map((groupId) => {
                          const group = panelGroups.find(g => g.id === groupId);
                          return (
                            <Badge
                              key={groupId}
                              variant="secondary"
                              className="cursor-pointer"
                              onClick={() => setSelectedPanelGroups(selectedPanelGroups.filter(id => id !== groupId))}
                            >
                              {group?.name} - {group?.project_name}
                              <span className="ml-1">×</span>
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleCreateNote}
                    disabled={isCreating}
                  >
                    {isCreating ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Creating...
                      </>
                    ) : (
                      'Create Note'
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Note</DialogTitle>
            <DialogDescription>
              Update the note and its associated panel groups.
            </DialogDescription>
          </DialogHeader>
          {selectedNote && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-title">Title</Label>
                <Input
                  id="edit-title"
                  value={selectedNote.title}
                  onChange={(e) => setSelectedNote({ ...selectedNote, title: e.target.value })}
                  placeholder="Enter note title"
                />
              </div>
              <div>
                <Label htmlFor="edit-content">Content</Label>
                <Textarea
                  id="edit-content"
                  value={selectedNote.content}
                  onChange={(e) => setSelectedNote({ ...selectedNote, content: e.target.value })}
                  placeholder="Enter note content"
                  rows={4}
                />
              </div>
              <div>
                <Label>Panel Groups</Label>
                <Select
                  value=""
                  onValueChange={(value) => {
                    if (value && !selectedPanelGroups.includes(value)) {
                      setSelectedPanelGroups([...selectedPanelGroups, value]);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select panel groups to add" />
                  </SelectTrigger>
                  <SelectContent>
                    {panelGroups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name} - {group.project_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedPanelGroups.length > 0 && (
                  <div className="mt-2 space-y-2">
                    <Label>Selected Panel Groups:</Label>
                    <div className="flex flex-wrap gap-2">
                      {selectedPanelGroups.map((groupId) => {
                        const group = panelGroups.find(g => g.id === groupId);
                        return (
                          <Badge
                            key={groupId}
                            variant="secondary"
                            className="cursor-pointer"
                            onClick={() => setSelectedPanelGroups(selectedPanelGroups.filter(id => id !== groupId))}
                          >
                            {group?.name} - {group?.project_name}
                            <span className="ml-1">×</span>
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleEditNote}>
                  Update Note
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NotesPage;
