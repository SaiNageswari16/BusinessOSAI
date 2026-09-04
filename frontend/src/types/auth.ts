export type Role = 'super_admin' | 'owner' | 'trainer' | 'customer';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar: string;
  gymId?: string;
  gymName?: string;
  branchName?: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
}
