import { AbilityBuilder, Ability, AbilityClass, Subject } from '@casl/ability';

type Actions = 'manage' | 'create' | 'read' | 'update' | 'delete';
type Subjects = 'Subscription' | 'User' | 'Compliance' | 'License' | 'Notification' | 'Settings' | 'Department' | 'all';

export type AppAbility = Ability<[Actions, Subjects]>;
export const AppAbility = Ability as AbilityClass<AppAbility>;

export interface User {
  role: string;
  userId: string;
  department?: string;
}

export function defineAbilityFor(user: User) {
  const { can, cannot, build } = new AbilityBuilder(AppAbility);

  switch (user.role) {
    case 'super_admin':
      // Super Admin: Full system access
      can('manage', 'all');
      break;

    case 'admin':
      // Admin: Full access to all modules except user management and system settings
      can('read', 'all');
      can('create', ['Subscription', 'Compliance', 'License', 'Notification']);
      can('update', ['Subscription', 'Compliance', 'License', 'Notification']);
      can('delete', ['Subscription', 'Compliance', 'License', 'Notification']);
      cannot('manage', 'User');
      cannot('manage', 'Settings');
      break;

    case 'viewer':
      // Viewer: Read-only access to everything
      can('read', 'all');
      cannot('create', 'all');
      cannot('update', 'all');
      cannot('delete', 'all');
      break;

    case 'contributor':
      // Contributor: Can create and manage only their own items
      // Note: Actual ownerId filtering will be done on the backend
      can('create', ['Subscription', 'Compliance', 'License']);
      can('read', ['Subscription', 'Compliance', 'License']);
      can('update', ['Subscription', 'Compliance', 'License']);
      can('delete', ['Subscription', 'Compliance', 'License']);
      cannot('read', 'User');
      cannot('read', 'Settings');
      break;

    case 'department_editor':
      // Department Editor: Can view and edit items within their department
      // Note: Actual department filtering will be done on the backend
      can('read', ['Subscription', 'Compliance', 'License']);
      can('create', ['Subscription', 'Compliance', 'License']);
      can('update', ['Subscription', 'Compliance', 'License']);
      can('delete', ['Subscription', 'Compliance', 'License']);
      cannot('read', 'User');
      cannot('read', 'Settings');
      break;

    case 'department_viewer':
      // Department Viewer: Read-only access to their department
      // Note: Actual department filtering will be done on the backend
      can('read', ['Subscription', 'Compliance', 'License']);
      cannot('create', 'all');
      cannot('update', 'all');
      cannot('delete', 'all');
      cannot('read', 'User');
      cannot('read', 'Settings');
      break;

    default:
      // Default: No permissions
      break;
  }

  return build();
}
