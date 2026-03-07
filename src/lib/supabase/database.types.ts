/**
 * Hand-written database type stubs.
 *
 * Replace with the output of:
 *   npx supabase gen types typescript --project-id <your-project-id>
 * once the schema (supabase/schema.sql) has been applied to your project.
 *
 * The Relationships arrays are required by @supabase/supabase-js for its
 * internal type inference — even an empty array is enough for the client
 * to correctly type query results.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          is_admin: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          display_name?: string;
          is_admin?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string;
          is_admin?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      whitelisted_emails: {
        Row: {
          id: string;
          email: string;
          added_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          added_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          added_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      race_weekends: {
        Row: {
          id: string;
          season: number;
          round: number;
          race_name: string;
          qualifying_deadline: string;
          race_start: string | null;
          p_what_position: number;
          results_synced: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          season: number;
          round: number;
          race_name: string;
          qualifying_deadline: string;
          race_start?: string | null;
          p_what_position: number;
          results_synced?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          season?: number;
          round?: number;
          race_name?: string;
          qualifying_deadline?: string;
          race_start?: string | null;
          p_what_position?: number;
          results_synced?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      predictions: {
        Row: {
          id: string;
          user_id: string;
          race_weekend_id: string;
          pole_position: string;
          top3_p1: string;
          top3_p2: string;
          top3_p3: string;
          biggest_surprise: string;
          biggest_flop: string;
          crazy_prediction: string;
          p_what_driver: string;
          submitted_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          race_weekend_id: string;
          pole_position: string;
          top3_p1: string;
          top3_p2: string;
          top3_p3: string;
          biggest_surprise: string;
          biggest_flop: string;
          crazy_prediction: string;
          p_what_driver: string;
          submitted_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          race_weekend_id?: string;
          pole_position?: string;
          top3_p1?: string;
          top3_p2?: string;
          top3_p3?: string;
          biggest_surprise?: string;
          biggest_flop?: string;
          crazy_prediction?: string;
          p_what_driver?: string;
          submitted_at?: string;
        };
        Relationships: [];
      };
      scores: {
        Row: {
          id: string;
          user_id: string;
          race_weekend_id: string;
          pole_correct: boolean;
          top3_p1_correct: boolean;
          top3_p2_correct: boolean;
          top3_p3_correct: boolean;
          surprise_correct: boolean | null;
          flop_correct: boolean | null;
          crazy_correct: boolean | null;
          p_what_correct: boolean;
          total_points: number;
        };
        Insert: {
          id?: string;
          user_id: string;
          race_weekend_id: string;
          pole_correct?: boolean;
          top3_p1_correct?: boolean;
          top3_p2_correct?: boolean;
          top3_p3_correct?: boolean;
          surprise_correct?: boolean | null;
          flop_correct?: boolean | null;
          crazy_correct?: boolean | null;
          p_what_correct?: boolean;
          total_points?: number;
        };
        Update: {
          id?: string;
          user_id?: string;
          race_weekend_id?: string;
          pole_correct?: boolean;
          top3_p1_correct?: boolean;
          top3_p2_correct?: boolean;
          top3_p3_correct?: boolean;
          surprise_correct?: boolean | null;
          flop_correct?: boolean | null;
          crazy_correct?: boolean | null;
          p_what_correct?: boolean;
          total_points?: number;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
