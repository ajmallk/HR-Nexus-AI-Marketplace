export type UserRole = 'buyer' | 'seller';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  bio?: string;
  avatar?: string;
}

export interface Project {
  id: string;
  buyer_id: string;
  buyer_name?: string;
  title: string;
  description: string;
  budget_min: number;
  budget_max: number;
  status: 'open' | 'closed' | 'in-progress';
  created_at: string;
}

export interface Bid {
  id: string;
  project_id: string;
  seller_id: string;
  seller_name?: string;
  amount: number;
  proposal: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
}

export interface Message {
  id: number;
  sender_id: string;
  receiver_id: string;
  content: string;
  timestamp: string;
}

export interface Milestone {
  id: string;
  project_id: string;
  title: string;
  amount: number;
  status: 'pending' | 'completed' | 'paid';
}
