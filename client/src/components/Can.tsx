import { useAbility } from '../context/AbilityContext';
import { Subject } from '@casl/ability';

interface CanProps {
  I: 'manage' | 'create' | 'read' | 'update' | 'delete';
  a: 'Subscription' | 'User' | 'Compliance' | 'License' | 'Notification' | 'Settings' | 'Department' | 'all';
  field?: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function Can({ I, a, field, children, fallback = null }: CanProps) {
  const ability = useAbility();
  
  const canPerform = ability.can(I, a as Subject, field);
  
  if (canPerform) {
    return <>{children}</>;
  }
  
  return <>{fallback}</>;
}
