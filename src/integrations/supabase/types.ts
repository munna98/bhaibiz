export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      accommodations: {
        Row: {
          address: string | null
          company_id: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          company_id: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accommodations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_accommodations: {
        Row: {
          accommodation_id: string
          company_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          accommodation_id: string
          company_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          accommodation_id?: string
          company_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_accommodations_accommodation_id_fkey"
            columns: ["accommodation_id"]
            isOneToOne: false
            referencedRelation: "accommodations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_accommodations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      adjustments: {
        Row: {
          amount_paise: number
          company_id: string
          created_at: string
          id: string
          kind: string
          on_date: string
          reason: string
          recorded_by: string
          worker_id: string
        }
        Insert: {
          amount_paise: number
          company_id: string
          created_at?: string
          id?: string
          kind: string
          on_date: string
          reason: string
          recorded_by: string
          worker_id: string
        }
        Update: {
          amount_paise?: number
          company_id?: string
          created_at?: string
          id?: string
          kind?: string
          on_date?: string
          reason?: string
          recorded_by?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "adjustments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adjustments_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "worker_balances"
            referencedColumns: ["worker_id"]
          },
          {
            foreignKeyName: "adjustments_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      advance_repayments: {
        Row: {
          amount_paise: number
          company_id: string
          created_at: string
          id: string
          method: Database["public"]["Enums"]["pay_method"]
          paid_on: string
          recorded_by: string
          reference: string | null
          worker_id: string
        }
        Insert: {
          amount_paise: number
          company_id: string
          created_at?: string
          id?: string
          method: Database["public"]["Enums"]["pay_method"]
          paid_on: string
          recorded_by: string
          reference?: string | null
          worker_id: string
        }
        Update: {
          amount_paise?: number
          company_id?: string
          created_at?: string
          id?: string
          method?: Database["public"]["Enums"]["pay_method"]
          paid_on?: string
          recorded_by?: string
          reference?: string | null
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "advance_repayments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advance_repayments_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "worker_balances"
            referencedColumns: ["worker_id"]
          },
          {
            foreignKeyName: "advance_repayments_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      advances: {
        Row: {
          amount_paise: number
          company_id: string
          created_at: string
          given_on: string
          id: string
          reason: string | null
          recorded_by: string
          worker_id: string
        }
        Insert: {
          amount_paise: number
          company_id: string
          created_at?: string
          given_on: string
          id?: string
          reason?: string | null
          recorded_by: string
          worker_id: string
        }
        Update: {
          amount_paise?: number
          company_id?: string
          created_at?: string
          given_on?: string
          id?: string
          reason?: string | null
          recorded_by?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "advances_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advances_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "worker_balances"
            referencedColumns: ["worker_id"]
          },
          {
            foreignKeyName: "advances_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          company_id: string
          created_at: string
          id: string
          marked_by: string
          status: Database["public"]["Enums"]["attendance_status"]
          updated_at: string
          work_date: string
          worker_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          marked_by: string
          status: Database["public"]["Enums"]["attendance_status"]
          updated_at?: string
          work_date: string
          worker_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          marked_by?: string
          status?: Database["public"]["Enums"]["attendance_status"]
          updated_at?: string
          work_date?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "worker_balances"
            referencedColumns: ["worker_id"]
          },
          {
            foreignKeyName: "attendance_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_history: {
        Row: {
          attendance_id: string
          changed_at: string
          changed_by: string
          company_id: string
          id: string
          new_status: Database["public"]["Enums"]["attendance_status"]
          old_status: Database["public"]["Enums"]["attendance_status"] | null
          reason: string | null
        }
        Insert: {
          attendance_id: string
          changed_at?: string
          changed_by: string
          company_id: string
          id?: string
          new_status: Database["public"]["Enums"]["attendance_status"]
          old_status?: Database["public"]["Enums"]["attendance_status"] | null
          reason?: string | null
        }
        Update: {
          attendance_id?: string
          changed_at?: string
          changed_by?: string
          company_id?: string
          id?: string
          new_status?: Database["public"]["Enums"]["attendance_status"]
          old_status?: Database["public"]["Enums"]["attendance_status"] | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_history_attendance_id_fkey"
            columns: ["attendance_id"]
            isOneToOne: false
            referencedRelation: "attendance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string
          at: string
          company_id: string
          details: Json | null
          entity: string
          entity_id: string | null
          id: string
        }
        Insert: {
          action: string
          actor_id?: string
          at?: string
          company_id: string
          details?: Json | null
          entity: string
          entity_id?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string
          at?: string
          company_id?: string
          details?: Json | null
          entity?: string
          entity_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_agreements: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          daily_rate_paise: number
          effective_from: string
          id: string
          note: string | null
          worker_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string
          daily_rate_paise: number
          effective_from: string
          id?: string
          note?: string | null
          worker_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string
          daily_rate_paise?: number
          effective_from?: string
          id?: string
          note?: string | null
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_agreements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_agreements_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "worker_balances"
            referencedColumns: ["worker_id"]
          },
          {
            foreignKeyName: "commission_agreements_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_entries: {
        Row: {
          amount_paise: number
          attendance_id: string
          company_id: string
          created_at: string
          created_by: string
          id: string
          kind: string
          reversed_at: string | null
          reverses_id: string | null
          work_date: string
          worker_id: string
        }
        Insert: {
          amount_paise: number
          attendance_id: string
          company_id: string
          created_at?: string
          created_by: string
          id?: string
          kind: string
          reversed_at?: string | null
          reverses_id?: string | null
          work_date: string
          worker_id: string
        }
        Update: {
          amount_paise?: number
          attendance_id?: string
          company_id?: string
          created_at?: string
          created_by?: string
          id?: string
          kind?: string
          reversed_at?: string | null
          reverses_id?: string | null
          work_date?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_entries_attendance_id_fkey"
            columns: ["attendance_id"]
            isOneToOne: false
            referencedRelation: "attendance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_entries_reverses_id_fkey"
            columns: ["reverses_id"]
            isOneToOne: false
            referencedRelation: "commission_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_entries_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "worker_balances"
            referencedColumns: ["worker_id"]
          },
          {
            foreignKeyName: "commission_entries_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          created_at: string
          created_by: string
          id: string
          name: string
          phone: string | null
          receipt_prefix: string
          subscription_expires_at: string | null
          subscription_notes: string | null
          trial_ends_at: string | null
          worker_seq: number
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by: string
          id?: string
          name: string
          phone?: string | null
          receipt_prefix?: string
          subscription_expires_at?: string | null
          subscription_notes?: string | null
          trial_ends_at?: string | null
          worker_seq?: number
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          phone?: string | null
          receipt_prefix?: string
          subscription_expires_at?: string | null
          subscription_notes?: string | null
          trial_ends_at?: string | null
          worker_seq?: number
        }
        Relationships: []
      }
      invites: {
        Row: {
          company_id: string
          created_at: string
          email: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          company_id: string
          created_at?: string
          email: string
          id?: string
          invited_by: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          company_id?: string
          created_at?: string
          email?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "invites_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          company_id: string
          company_name: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          company_id: string
          company_name?: string | null
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          company_id?: string
          company_name?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_allocations: {
        Row: {
          amount_paise: number
          commission_entry_id: string
          company_id: string
          id: string
          payment_id: string
        }
        Insert: {
          amount_paise: number
          commission_entry_id: string
          company_id: string
          id?: string
          payment_id: string
        }
        Update: {
          amount_paise?: number
          commission_entry_id?: string
          company_id?: string
          id?: string
          payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_allocations_commission_entry_id_fkey"
            columns: ["commission_entry_id"]
            isOneToOne: false
            referencedRelation: "commission_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_paise: number
          company_id: string
          created_at: string
          id: string
          method: Database["public"]["Enums"]["pay_method"]
          paid_on: string
          receipt_no: string
          recorded_by: string
          reference: string | null
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
          worker_id: string
        }
        Insert: {
          amount_paise: number
          company_id: string
          created_at?: string
          id?: string
          method: Database["public"]["Enums"]["pay_method"]
          paid_on: string
          receipt_no: string
          recorded_by: string
          reference?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
          worker_id: string
        }
        Update: {
          amount_paise?: number
          company_id?: string
          created_at?: string
          id?: string
          method?: Database["public"]["Enums"]["pay_method"]
          paid_on?: string
          receipt_no?: string
          recorded_by?: string
          reference?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "worker_balances"
            referencedColumns: ["worker_id"]
          },
          {
            foreignKeyName: "payments_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          username: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          username?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          username?: string | null
        }
        Relationships: []
      }
      receipt_counters: {
        Row: {
          company_id: string
          seq: number
          year: number
        }
        Insert: {
          company_id: string
          seq?: number
          year: number
        }
        Update: {
          company_id?: string
          seq?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "receipt_counters_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_aadhaar: {
        Row: {
          cipher: string
          company_id: string
          updated_at: string
          worker_id: string
        }
        Insert: {
          cipher: string
          company_id: string
          updated_at?: string
          worker_id: string
        }
        Update: {
          cipher?: string
          company_id?: string
          updated_at?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_aadhaar_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_aadhaar_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: true
            referencedRelation: "worker_balances"
            referencedColumns: ["worker_id"]
          },
          {
            foreignKeyName: "worker_aadhaar_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: true
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_documents: {
        Row: {
          company_id: string
          doc_type: string
          file_name: string | null
          id: string
          storage_path: string
          uploaded_at: string
          uploaded_by: string
          worker_id: string
        }
        Insert: {
          company_id: string
          doc_type?: string
          file_name?: string | null
          id?: string
          storage_path: string
          uploaded_at?: string
          uploaded_by?: string
          worker_id: string
        }
        Update: {
          company_id?: string
          doc_type?: string
          file_name?: string | null
          id?: string
          storage_path?: string
          uploaded_at?: string
          uploaded_by?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_documents_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "worker_balances"
            referencedColumns: ["worker_id"]
          },
          {
            foreignKeyName: "worker_documents_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_status_history: {
        Row: {
          changed_at: string
          changed_by: string
          company_id: string
          effective_date: string
          id: string
          reason: string | null
          status: Database["public"]["Enums"]["worker_status"]
          worker_id: string
        }
        Insert: {
          changed_at?: string
          changed_by: string
          company_id: string
          effective_date: string
          id?: string
          reason?: string | null
          status: Database["public"]["Enums"]["worker_status"]
          worker_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string
          company_id?: string
          effective_date?: string
          id?: string
          reason?: string | null
          status?: Database["public"]["Enums"]["worker_status"]
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_status_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_status_history_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "worker_balances"
            referencedColumns: ["worker_id"]
          },
          {
            foreignKeyName: "worker_status_history_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      workers: {
        Row: {
          aadhaar_hash: string
          aadhaar_last4: string
          accommodation_id: string | null
          alt_mobile: string | null
          category: string | null
          company_id: string
          created_at: string
          created_by: string
          emergency_name: string | null
          emergency_phone: string | null
          full_name: string
          id: string
          joining_date: string
          kerala_address: string | null
          mobile: string
          native_address: string | null
          native_state: string | null
          notes: string | null
          photo_path: string | null
          status: Database["public"]["Enums"]["worker_status"]
          updated_at: string
          worker_code: string
        }
        Insert: {
          aadhaar_hash: string
          aadhaar_last4: string
          accommodation_id?: string | null
          alt_mobile?: string | null
          category?: string | null
          company_id: string
          created_at?: string
          created_by: string
          emergency_name?: string | null
          emergency_phone?: string | null
          full_name: string
          id?: string
          joining_date?: string
          kerala_address?: string | null
          mobile: string
          native_address?: string | null
          native_state?: string | null
          notes?: string | null
          photo_path?: string | null
          status?: Database["public"]["Enums"]["worker_status"]
          updated_at?: string
          worker_code: string
        }
        Update: {
          aadhaar_hash?: string
          aadhaar_last4?: string
          accommodation_id?: string | null
          alt_mobile?: string | null
          category?: string | null
          company_id?: string
          created_at?: string
          created_by?: string
          emergency_name?: string | null
          emergency_phone?: string | null
          full_name?: string
          id?: string
          joining_date?: string
          kerala_address?: string | null
          mobile?: string
          native_address?: string | null
          native_state?: string | null
          notes?: string | null
          photo_path?: string | null
          status?: Database["public"]["Enums"]["worker_status"]
          updated_at?: string
          worker_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "workers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      worker_balances: {
        Row: {
          adjusted_paise: number | null
          advance_balance_paise: number | null
          collected_paise: number | null
          company_id: string | null
          earned_paise: number | null
          status: Database["public"]["Enums"]["worker_status"] | null
          worker_id: string | null
        }
        Insert: {
          adjusted_paise?: never
          advance_balance_paise?: never
          collected_paise?: never
          company_id?: string | null
          earned_paise?: never
          status?: Database["public"]["Enums"]["worker_status"] | null
          worker_id?: string | null
        }
        Update: {
          adjusted_paise?: never
          advance_balance_paise?: never
          collected_paise?: never
          company_id?: string | null
          earned_paise?: never
          status?: Database["public"]["Enums"]["worker_status"] | null
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_my_invites: { Args: never; Returns: number }
      add_team_member: {
        Args: {
          _company: string
          _role: Database["public"]["Enums"]["app_role"]
          _user: string
        }
        Returns: undefined
      }
      add_adjustment: {
        Args: {
          _amount: number
          _kind: string
          _on_date: string
          _reason: string
          _worker: string
        }
        Returns: string
      }
      can_handle_money: { Args: { _company: string }; Returns: boolean }
      can_manage_workers: { Args: { _company: string }; Returns: boolean }
      create_company: {
        Args: { _address: string; _name: string; _phone: string }
        Returns: string
      }
      create_worker: {
        Args: {
          _aadhaar_cipher: string
          _aadhaar_hash: string
          _aadhaar_last4: string
          _company: string
          _rate_from: string
          _rate_paise: number
          _w: Json
        }
        Returns: string
      }
      give_advance: {
        Args: {
          _amount: number
          _given_on: string
          _reason: string
          _worker: string
        }
        Returns: string
      }
      has_role: {
        Args: {
          _company: string
          _role: Database["public"]["Enums"]["app_role"]
        }
        Returns: boolean
      }
      is_member: { Args: { _company: string }; Returns: boolean }
      mark_attendance: {
        Args: {
          _date: string
          _reason?: string
          _status: Database["public"]["Enums"]["attendance_status"]
          _worker: string
        }
        Returns: string
      }
      mark_attendance_bulk: {
        Args: {
          _date: string
          _status: Database["public"]["Enums"]["attendance_status"]
          _workers: string[]
        }
        Returns: number
      }
      path_company: { Args: { _name: string }; Returns: string }
      record_payment: {
        Args: {
          _amount: number
          _method: Database["public"]["Enums"]["pay_method"]
          _paid_on: string
          _reference: string
          _worker: string
        }
        Returns: string
      }
      repay_advance: {
        Args: {
          _amount: number
          _method: Database["public"]["Enums"]["pay_method"]
          _paid_on: string
          _reference: string
          _worker: string
        }
        Returns: string
      }
      set_worker_aadhaar: {
        Args: {
          _aadhaar_cipher: string
          _aadhaar_hash: string
          _aadhaar_last4: string
          _worker: string
        }
        Returns: undefined
      }
      set_worker_status: {
        Args: {
          _date: string
          _reason: string
          _status: Database["public"]["Enums"]["worker_status"]
          _worker: string
        }
        Returns: undefined
      }
      shares_company: { Args: { _user: string }; Returns: boolean }
      void_payment: {
        Args: { _payment: string; _reason: string }
        Returns: undefined
      }
      worker_outstanding: { Args: { _worker: string }; Returns: number }
    }
    Enums: {
      app_role: "owner" | "manager" | "operator" | "accountant"
      attendance_status: "worked" | "not_worked"
      pay_method: "cash" | "upi" | "bank" | "other"
      worker_status: "active" | "inactive"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["owner", "manager", "operator", "accountant"],
      attendance_status: ["worked", "not_worked"],
      pay_method: ["cash", "upi", "bank", "other"],
      worker_status: ["active", "inactive"],
    },
  },
} as const
