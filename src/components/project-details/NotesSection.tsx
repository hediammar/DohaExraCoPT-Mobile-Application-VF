import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Edit, Trash2, FileText, Calendar, Search } from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../ui/alert-dialog";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { hasPermission, UserRole } from "../../utils/rolePermissions";
import { useToastContext } from "../../contexts/ToastContext";

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
}

interface NotesSectionProps {
  projectId: string;
  projectName?: string;
}

export function NotesSection({ projectId, projectName }: NotesSectionProps) {
  const { user: currentUser } = useAuth();
  const { showToast } = useToastContext();
  const navigate = useNavigate();
  
  const [notes, setNotes] = useState<Note[]>([]);
  const [panelGroups, setPanelGroups] = useState<PanelGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [selectedPanelGroups, setSelectedPanelGroups] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    content: "",
  });

  const canCreateNotes = currentUser?.role ? hasPermission(currentUser.role as UserRole, 'notes', 'canCreate') : false;
  const canUpdateNotes = currentUser?.role ? hasPermission(currentUser.role as UserRole, 'notes', 'canUpdate') : false;
  const canDeleteNotes = currentUser?.role ? hasPermission(currentUser.role as UserRole, 'notes', 'canDelete') : false;

  useEffect(() => {
    if (projectId) {
      loadNotes();
      loadPanelGroups();
    }
  }, [projectId]);

  const loadPanelGroups = async () => {
    try {
      const { data, error } = await supabase
        .from('panel_groups')
        .select('id, name, description, project_id')
        .eq('project_id', projectId)
        .order('name');

      if (error) {
        console.error('Error loading panel groups:', error);
        return;
      }

      setPanelGroups(data || []);
    } catch (err) {
      console.error('Error loading panel groups:', err);
    }
  };

  const loadNotes = async () => {
    try {
      setLoading(true);
      
      // First, get all panel groups for this project
      const { data: panelGroupsData, error: panelGroupsError } = await supabase
        .from('panel_groups')
        .select('id')
        .eq('project_id', projectId);

      if (panelGroupsError) {
        console.error('Error loading panel groups:', panelGroupsError);
        showToast('Error loading panel groups', 'error');
        return;
      }

      if (!panelGroupsData || panelGroupsData.length === 0) {
        setNotes([]);
        setLoading(false);
        return;
      }

      const panelGroupIds = panelGroupsData.map(pg => pg.id);

      // Get notes that are linked to panel groups from this project
      const { data: notePanelGroupsData, error: notePanelGroupsError } = await supabase
        .from('note_panel_groups')
        .select('note_id')
        .in('panel_group_id', panelGroupIds);

      if (notePanelGroupsError) {
        console.error('Error loading note panel groups:', notePanelGroupsError);
        showToast('Error loading note panel groups', 'error');
        return;
      }

      if (!notePanelGroupsData || notePanelGroupsData.length === 0) {
        setNotes([]);
        setLoading(false);
        return;
      }

      const noteIds = Array.from(new Set(notePanelGroupsData.map(npg => npg.note_id)));

      // Finally, get the actual notes
      const { data: notesData, error: notesError } = await supabase
        .from('notes')
        .select('*')
        .in('id', noteIds)
        .order('created_at', { ascending: false });

      if (notesError) {
        console.error('Error loading notes:', notesError);
        showToast('Error loading notes', 'error');
        return;
      }

      setNotes(notesData || []);
    } catch (err) {
      console.error('Error loading notes:', err);
      showToast('Error loading notes', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNote = async () => {
    if (!formData.title.trim()) {
      showToast('Note title is required', 'error');
      return;
    }

    if (selectedPanelGroups.length === 0) {
      showToast('Please select at least one panel group', 'error');
      return;
    }

    if (isCreating) {
      return; // Prevent double-clicking
    }

    setIsCreating(true);
    try {
      // Create the note
      const { data, error } = await supabase
        .from('notes')
        .insert([{
          title: formData.title.trim(),
          content: formData.content.trim(),
        }])
        .select()
        .single();

      if (error) {
        console.error('Error creating note:', error);
        showToast('Error creating note', 'error');
        return;
      }

      // Link the note to selected panel groups
      const notePanelGroups = selectedPanelGroups.map(panelGroupId => ({
        note_id: data.id,
        panel_group_id: panelGroupId
      }));

      const { error: addGroupsError } = await supabase
        .from('note_panel_groups')
        .insert(notePanelGroups);

      if (addGroupsError) {
        console.error('Error linking note to panel groups:', addGroupsError);
        showToast('Error linking note to panel groups', 'error');
        return;
      }

      setNotes([data, ...notes]);
      setFormData({ title: "", content: "" });
      setSelectedPanelGroups([]);
      setIsCreateDialogOpen(false);
      showToast('Note created successfully', 'success');
    } catch (err) {
      console.error('Error creating note:', err);
      showToast('Error creating note', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateNote = async () => {
    if (!editingNote || !formData.title.trim()) {
      showToast('Note title is required', 'error');
      return;
    }

    try {
      // Update the note
      const { error: noteError } = await supabase
        .from('notes')
        .update({
          title: formData.title.trim(),
          content: formData.content.trim()
        })
        .eq('id', editingNote.id);

      if (noteError) {
        console.error('Error updating note:', noteError);
        showToast('Error updating note', 'error');
        return;
      }

      // Remove all existing panel groups and add the new selection
      const { error: removeError } = await supabase
        .from('note_panel_groups')
        .delete()
        .eq('note_id', editingNote.id);

      if (removeError) {
        console.error('Error removing panel groups:', removeError);
        showToast('Error updating panel groups', 'error');
        return;
      }

      // Add new panel groups if any are selected
      if (selectedPanelGroups.length > 0) {
        const notePanelGroups = selectedPanelGroups.map(panelGroupId => ({
          note_id: editingNote.id,
          panel_group_id: panelGroupId
        }));

        const { error: addGroupsError } = await supabase
          .from('note_panel_groups')
          .insert(notePanelGroups);

        if (addGroupsError) {
          console.error('Error adding panel groups:', addGroupsError);
          showToast('Error updating panel groups', 'error');
          return;
        }
      }

      // Update the local state
      const updatedNote = {
        ...editingNote,
        title: formData.title.trim(),
        content: formData.content.trim(),
      };
      setNotes(notes.map(note => note.id === editingNote.id ? updatedNote : note));
      setFormData({ title: "", content: "" });
      setSelectedPanelGroups([]);
      setEditingNote(null);
      setIsEditDialogOpen(false);
      showToast('Note updated successfully', 'success');
    } catch (err) {
      console.error('Error updating note:', err);
      showToast('Error updating note', 'error');
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    
    try {
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', noteId);

      if (error) {
        console.error('Error deleting note:', error);
        showToast('Error deleting note', 'error');
        return;
      }

      setNotes(notes.filter(note => note.id !== noteId));
      showToast('Note deleted successfully', 'success');
    } catch (err) {
      console.error('Error deleting note:', err);
      showToast('Error deleting note', 'error');
    }
  };

  const openEditDialog = async (note: Note) => {
    setEditingNote(note);
    setFormData({
      title: note.title,
      content: note.content,
    });
    
    // Load existing panel groups for this note
    try {
      const { data: notePanelGroupsData, error } = await supabase
        .from('note_panel_groups')
        .select('panel_group_id')
        .eq('note_id', note.id);

      if (error) {
        console.error('Error loading note panel groups:', error);
        setSelectedPanelGroups([]);
      } else {
        const panelGroupIds = notePanelGroupsData?.map(item => item.panel_group_id) || [];
        setSelectedPanelGroups(panelGroupIds);
      }
    } catch (err) {
      console.error('Error loading note panel groups:', err);
      setSelectedPanelGroups([]);
    }
    
    setIsEditDialogOpen(true);
  };

  const closeEditDialog = () => {
    setEditingNote(null);
    setFormData({ title: "", content: "" });
    setSelectedPanelGroups([]);
    setIsEditDialogOpen(false);
  };

  const closeCreateDialog = () => {
    setFormData({ title: "", content: "" });
    setSelectedPanelGroups([]);
    setIsCreateDialogOpen(false);
  };

  const handleNoteClick = (noteId: string) => {
    navigate(`/notes/${noteId}`);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const filteredNotes = notes.filter(note =>
    note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    note.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading notes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Notes</h2>
          <Badge variant="secondary" className="ml-2">
            {filteredNotes.length}
          </Badge>
          {projectName && (
            <span className="text-sm text-muted-foreground">
              in {projectName}
            </span>
          )}
        </div>
        <div>
          {canCreateNotes && panelGroups.length > 0 && (
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="qatar-button" disabled={isCreating}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Note
                </Button>
              </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Create New Note</DialogTitle>
                <DialogDescription>
                  Add a new note for {projectName || 'this project'}.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    placeholder="Enter note title..."
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="content">Content</Label>
                  <Textarea
                    id="content"
                    placeholder="Enter note content..."
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    rows={6}
                  />
                </div>
                <div className="space-y-2">
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
                          {group.name}
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
                              {group?.name}
                              <span className="ml-1">×</span>
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeCreateDialog}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateNote} 
                  className="qatar-button"
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
              </DialogFooter>
            </DialogContent>
          </Dialog>
          )}
        </div>
      </div>

      {/* Filters & Search */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Filters & Search</CardTitle>
            {searchTerm !== "" && (
              <Badge variant="secondary" className="h-5 w-5 p-0 text-xs">
                1
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label>Search</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search notes..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              Showing {filteredNotes.length} of {notes.length} notes
            </div>
            <Button variant="outline" size="sm" onClick={() => setSearchTerm("")}>
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Notes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredNotes.map((note) => (
          <Card
            key={note.id}
            className="qatar-card flex flex-col justify-between cursor-pointer hover:shadow-xl transition-shadow"
            onClick={() => handleNoteClick(note.id)}
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
                  {formatDate(note.created_at)}
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

                <div className="prose prose-sm max-w-none">
                  <p className="text-muted-foreground whitespace-pre-wrap line-clamp-3">
                    {note.content}
                  </p>
                </div>
              </div>

              <div className="qatar-card-footer">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">
                    Created: {formatDate(note.created_at)}
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

      {filteredNotes.length === 0 && (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">
            {searchTerm ? 'No notes found' : 'No notes yet'}
          </h3>
          <p className="text-muted-foreground mb-4">
            {searchTerm 
              ? 'Try adjusting your search terms'
              : panelGroups.length === 0 
                ? 'No panel groups found in this project. Create panel groups first to add notes.'
                : 'Get started by adding your first note'
            }
          </p>
          {!searchTerm && canCreateNotes && panelGroups.length > 0 && (
            <Button 
              onClick={() => setIsCreateDialogOpen(true)} 
              className="qatar-button"
              disabled={isCreating}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Note
            </Button>
          )}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Note</DialogTitle>
            <DialogDescription>
              Update the note details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                placeholder="Enter note title..."
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-content">Content</Label>
              <Textarea
                id="edit-content"
                placeholder="Enter note content..."
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                rows={6}
              />
            </div>
            <div className="space-y-2">
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
                      {group.name}
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
                          {group?.name}
                          <span className="ml-1">×</span>
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeEditDialog}>
              Cancel
            </Button>
            <Button onClick={handleUpdateNote} className="qatar-button">
              Update Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
