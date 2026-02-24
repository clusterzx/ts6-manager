import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { FileQuestion } from 'lucide-react';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
      <div className="h-16 w-16 rounded-2xl bg-muted/30 flex items-center justify-center">
        <FileQuestion className="h-8 w-8 text-muted-foreground" />
      </div>
      <h1 className="text-2xl font-semibold">Page Not Found</h1>
      <p className="text-sm text-muted-foreground max-w-sm">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Button variant="outline" onClick={() => navigate('/dashboard')}>
        Back to Dashboard
      </Button>
    </div>
  );
}
