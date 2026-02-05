import { useAbility } from '../context/AbilityContext';

interface CanProps {
  I: 'manage' | 'create' | 'read' | 'update' | 'delete';
  a: 'Subscription' | 'User' | 'Compliance' | 'License' | 'Notification' | 'Settings' | 'Department' | 'all';
  field?: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function Can({ I, a, field, children, fallback = null }: CanProps) {
  const ability = useAbility();
  
  const canPerform = ability.can(I, a, field);
  
  if (canPerform) {
    return <>{children}</>;
  }
  
  return <>{fallback}</>;
}
