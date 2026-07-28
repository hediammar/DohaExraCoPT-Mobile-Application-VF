import { Avatar } from "./ui/avatar";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { User, Settings, LogOut, Menu } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";

interface UserHeaderProps {
  onMobileMenuToggle?: () => void;
}

export function UserHeader({ onMobileMenuToggle }: UserHeaderProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <header className="sticky-header border-b border-sidebar-border bg-background/95 backdrop-blur-sm">
      <div className="flex items-center justify-between px-4 sm:px-6 py-3">
        <div className="flex items-center gap-4">
          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onMobileMenuToggle}
            className="md:hidden w-10 h-10 p-0"
            title="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <h2>Qatar Panel Tracker</h2>
        </div>
        
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-xs">
            {user?.role || 'User'}
          </Badge>
          
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <div className="h-full w-full bg-primary rounded-full flex items-center justify-center">
                <span className="text-xs font-medium text-primary-foreground">
                  {user ? getInitials(user.name) : 'U'}
                </span>
              </div>
            </Avatar>
            
            <div className="hidden sm:block">
              <p className="text-sm font-medium">{user?.name || 'User'}</p>
              <p className="text-xs text-muted-foreground">{user?.role || 'User'}</p>
            </div>
          </div>
          
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}