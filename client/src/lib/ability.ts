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
      // Admin: Full access to all modules except user management
      can('manage', ['Subscription', 'Compliance', 'License', 'Notification', 'Department', 'Settings']);
      can('read', 'all');
      cannot('create', 'User');
      cannot('update', 'User');
      cannot('delete', 'User');
      cannot('read', 'User');
      break;

    case 'viewer':
      // Viewer: Read-only access to everything except user management
      can('read', ['Subscription', 'Compliance', 'License', 'Notification', 'Department', 'Settings']);
      cannot('create', 'all');
      cannot('update', 'all');
      cannot('delete', 'all');
      cannot('read', 'User');
      cannot('manage', 'all');
      break;

    case 'contributor':
      // Contributor: Can create and manage only their own items
      // Note: Actual ownerId filtering will be done on the backend
      can('create', ['Subscription', 'Compliance', 'License', 'Notification']);
      can('read', ['Subscription', 'Compliance', 'License', 'Notification', 'Department']);
      can('update', ['Subscription', 'Compliance', 'License', 'Notification']);
      can('delete', ['Subscription', 'Compliance', 'License']);
      can('read', 'Settings');
      cannot('manage', 'User');
      cannot('manage', 'Department');
      break;

    case 'department_editor':
      // Department Editor: Can view and edit items within their department
      // Note: Actual department filtering will be done on the backend
      can('read', ['Subscription', 'Compliance', 'License', 'Notification', 'Department']);
      can('create', ['Subscription', 'Compliance', 'License', 'Notification']);
      can('update', ['Subscription', 'Compliance', 'License', 'Notification']);
      can('delete', ['Subscription', 'Compliance', 'License']);
      can('read', 'Settings');
      cannot('manage', 'User');
      cannot('manage', 'Department');
      break;

    case 'department_viewer':
      // Department Viewer: Read-only access to their department
      // Note: Actual department filtering will be done on the backend
      can('read', ['Subscription', 'Compliance', 'License', 'Notification', 'Department', 'Settings']);
      cannot('create', 'all');
      cannot('update', 'all');
      cannot('delete', 'all');
      cannot('manage', 'User');
      cannot('manage', 'Department');
      break;

    default:
      // Default: No permissions
      break;
  }

  return build();
}
