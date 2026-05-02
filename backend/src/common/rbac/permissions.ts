export type ActorRole = 'Admin' | 'Manager' | 'Operator';

export type Permission =
  | 'users.read'
  | 'users.create'
  | 'users.update'
  | 'users.delete';

export type ActorContext = {
  userID: number;
  role: ActorRole;
};

const ROLE_PERMISSIONS: Record<ActorRole, Permission[]> = {
  Admin: ['users.read', 'users.create', 'users.update', 'users.delete'],
  Manager: ['users.read'],
  Operator: [],
};

export function isActorRole(value: unknown): value is ActorRole {
  return value === 'Admin' || value === 'Manager' || value === 'Operator';
}

export function hasPermission(
  role: ActorRole,
  permission: Permission,
): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
