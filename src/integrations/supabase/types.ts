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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          ip: string | null
          route: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip?: string | null
          route?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip?: string | null
          route?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attachments: {
        Row: {
          bucket: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          filename: string | null
          id: string
          mime: string | null
          path: string
          size: number | null
          uploaded_by: string | null
        }
        Insert: {
          bucket?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          filename?: string | null
          id?: string
          mime?: string | null
          path: string
          size?: number | null
          uploaded_by?: string | null
        }
        Update: {
          bucket?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          filename?: string | null
          id?: string
          mime?: string | null
          path?: string
          size?: number | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          after: Json | null
          before: Json | null
          created_at: string
          id: string
          ip: string | null
          target_id: string | null
          target_table: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: string
          ip?: string | null
          target_id?: string | null
          target_table?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: string
          ip?: string | null
          target_id?: string | null
          target_table?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      case_tasks: {
        Row: {
          assignee_id: string | null
          case_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          done_at: string | null
          due_date: string | null
          id: string
          priority: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          case_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          done_at?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          case_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          done_at?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_tasks_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_tasks_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_tasks_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_warranty_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cases: {
        Row: {
          acceptance_date: string | null
          amount: number | null
          client_id: string | null
          closed_at: string | null
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          go_live_date: string | null
          id: string
          kickoff_date: string | null
          note: string | null
          owner_id: string | null
          priority: string
          start_date: string | null
          status: string
          system_id: string | null
          title: string
          type: string | null
          updated_at: string
          warranty_end: string | null
          warranty_months: number | null
        }
        Insert: {
          acceptance_date?: string | null
          amount?: number | null
          client_id?: string | null
          closed_at?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          go_live_date?: string | null
          id?: string
          kickoff_date?: string | null
          note?: string | null
          owner_id?: string | null
          priority?: string
          start_date?: string | null
          status?: string
          system_id?: string | null
          title: string
          type?: string | null
          updated_at?: string
          warranty_end?: string | null
          warranty_months?: number | null
        }
        Update: {
          acceptance_date?: string | null
          amount?: number | null
          client_id?: string | null
          closed_at?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          go_live_date?: string | null
          id?: string
          kickoff_date?: string | null
          note?: string | null
          owner_id?: string | null
          priority?: string
          start_date?: string | null
          status?: string
          system_id?: string | null
          title?: string
          type?: string | null
          updated_at?: string
          warranty_end?: string | null
          warranty_months?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cases_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_payment_due"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "cases_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_receivables_by_client"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "cases_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "v_maintenance_alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      changelogs: {
        Row: {
          content: string | null
          created_at: string
          id: string
          released_at: string | null
          title: string
          type: string | null
          version: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          released_at?: string | null
          title: string
          type?: string | null
          version: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          released_at?: string | null
          title?: string
          type?: string | null
          version?: string
        }
        Relationships: []
      }
      client_contacts: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          is_primary: boolean
          name: string
          note: string | null
          phone: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_primary?: boolean
          name: string
          note?: string | null
          phone?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_primary?: boolean
          name?: string
          note?: string | null
          phone?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_payment_due"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_receivables_by_client"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_contacts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_notes: {
        Row: {
          client_id: string
          contact_date: string
          content: string
          created_at: string
          created_by: string | null
          id: string
          type: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          contact_date?: string
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          type?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          contact_date?: string
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_payment_due"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_receivables_by_client"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          code: string
          contact_name: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          name: string
          note: string | null
          phone: string | null
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          code: string
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name: string
          note?: string | null
          phone?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string
          note?: string | null
          phone?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_logs: {
        Row: {
          action: string
          created_at: string | null
          created_by: string | null
          id: string
          next_follow_date: string | null
          note: string | null
          payment_id: string | null
        }
        Insert: {
          action?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          next_follow_date?: string | null
          note?: string | null
          payment_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          next_follow_date?: string | null
          note?: string | null
          payment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collection_logs_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_logs_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "v_payment_due"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_entries: {
        Row: {
          base_amount: number | null
          commission_amount: number | null
          contract_id: string | null
          created_at: string | null
          created_by: string | null
          deal_role: string | null
          id: string
          note: string | null
          payee_id: string
          payment_id: string | null
          payout_period: string | null
          payout_status: string
          plan_id: string | null
          project_id: string | null
          rate: number | null
          realized: boolean
          realized_on: string | null
          updated_at: string | null
        }
        Insert: {
          base_amount?: number | null
          commission_amount?: number | null
          contract_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deal_role?: string | null
          id?: string
          note?: string | null
          payee_id: string
          payment_id?: string | null
          payout_period?: string | null
          payout_status?: string
          plan_id?: string | null
          project_id?: string | null
          rate?: number | null
          realized?: boolean
          realized_on?: string | null
          updated_at?: string | null
        }
        Update: {
          base_amount?: number | null
          commission_amount?: number | null
          contract_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deal_role?: string | null
          id?: string
          note?: string | null
          payee_id?: string
          payment_id?: string | null
          payout_period?: string | null
          payout_status?: string
          plan_id?: string | null
          project_id?: string | null
          rate?: number | null
          realized?: boolean
          realized_on?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commission_entries_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_entries_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "v_contract_expiry_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_entries_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "v_contract_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_entries_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "v_payment_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_entries_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_entries_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "v_payment_due"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_entries_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "commission_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_case_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_warranty_status"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_plans: {
        Row: {
          base: string
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          note: string | null
          rate: number | null
          tiers: Json | null
        }
        Insert: {
          base?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          note?: string | null
          rate?: number | null
          tiers?: Json | null
        }
        Update: {
          base?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          note?: string | null
          rate?: number | null
          tiers?: Json | null
        }
        Relationships: []
      }
      contracts: {
        Row: {
          auto_renew: boolean
          billing_type: string | null
          client_id: string | null
          contract_amount: number | null
          contract_no: string | null
          contract_type: string
          contract_url: string | null
          created_at: string
          created_by: string | null
          dev_fee: number | null
          end_date: string | null
          id: string
          included_hours: number | null
          invoice_status: string
          maintenance_fee: number | null
          maintenance_period: string | null
          next_payment_date: string | null
          note: string | null
          payment_status: string
          project_id: string | null
          signed_date: string | null
          sla_hours: number | null
          start_date: string | null
          status: string
          system_id: string | null
          term_months: number | null
          title: string | null
          updated_at: string
        }
        Insert: {
          auto_renew?: boolean
          billing_type?: string | null
          client_id?: string | null
          contract_amount?: number | null
          contract_no?: string | null
          contract_type?: string
          contract_url?: string | null
          created_at?: string
          created_by?: string | null
          dev_fee?: number | null
          end_date?: string | null
          id?: string
          included_hours?: number | null
          invoice_status?: string
          maintenance_fee?: number | null
          maintenance_period?: string | null
          next_payment_date?: string | null
          note?: string | null
          payment_status?: string
          project_id?: string | null
          signed_date?: string | null
          sla_hours?: number | null
          start_date?: string | null
          status?: string
          system_id?: string | null
          term_months?: number | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          auto_renew?: boolean
          billing_type?: string | null
          client_id?: string | null
          contract_amount?: number | null
          contract_no?: string | null
          contract_type?: string
          contract_url?: string | null
          created_at?: string
          created_by?: string | null
          dev_fee?: number | null
          end_date?: string | null
          id?: string
          included_hours?: number | null
          invoice_status?: string
          maintenance_fee?: number | null
          maintenance_period?: string | null
          next_payment_date?: string | null
          note?: string | null
          payment_status?: string
          project_id?: string | null
          signed_date?: string | null
          sla_hours?: number | null
          start_date?: string | null
          status?: string
          system_id?: string | null
          term_months?: number | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_payment_due"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_receivables_by_client"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "contracts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_case_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_warranty_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "v_maintenance_alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      dev_todos: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          done_at: string | null
          id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          done_at?: string | null
          id?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          done_at?: string | null
          id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dev_todos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      doc_pages: {
        Row: {
          content: string | null
          id: string
          key: string
          title: string | null
          updated_at: string
        }
        Insert: {
          content?: string | null
          id?: string
          key: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          content?: string | null
          id?: string
          key?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      error_logs: {
        Row: {
          context: Json | null
          created_at: string
          id: string
          level: string
          message: string | null
          route: string | null
          stack: string | null
          user_id: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string
          id?: string
          level?: string
          message?: string | null
          route?: string | null
          stack?: string | null
          user_id?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string
          id?: string
          level?: string
          message?: string | null
          route?: string | null
          stack?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "error_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_requests: {
        Row: {
          area: string | null
          created_at: string
          description: string | null
          id: string
          points_cost: number
          status: string
          submitter_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          area?: string | null
          created_at?: string
          description?: string | null
          id?: string
          points_cost?: number
          status?: string
          submitter_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          area?: string | null
          created_at?: string
          description?: string | null
          id?: string
          points_cost?: number
          status?: string
          submitter_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feature_requests_submitter_id_fkey"
            columns: ["submitter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          code: string
          created_at: string
          email: string | null
          expires_at: string | null
          id: string
          invited_by: string | null
          role_id: string | null
          status: string
          used_at: string | null
        }
        Insert: {
          code: string
          created_at?: string
          email?: string | null
          expires_at?: string | null
          id?: string
          invited_by?: string | null
          role_id?: string | null
          status?: string
          used_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          email?: string | null
          expires_at?: string | null
          id?: string
          invited_by?: string | null
          role_id?: string | null
          status?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_total: number | null
          amount_untaxed: number | null
          buyer_name: string | null
          buyer_tax_id: string | null
          contract_id: string | null
          created_at: string | null
          created_by: string | null
          id: string
          invoice_date: string | null
          invoice_no: string | null
          note: string | null
          payment_id: string | null
          status: string | null
          tax: number | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          amount_total?: number | null
          amount_untaxed?: number | null
          buyer_name?: string | null
          buyer_tax_id?: string | null
          contract_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          invoice_date?: string | null
          invoice_no?: string | null
          note?: string | null
          payment_id?: string | null
          status?: string | null
          tax?: number | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          amount_total?: number | null
          amount_untaxed?: number | null
          buyer_name?: string | null
          buyer_tax_id?: string | null
          contract_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          invoice_date?: string | null
          invoice_no?: string | null
          note?: string | null
          payment_id?: string | null
          status?: string | null
          tax?: number | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "v_contract_expiry_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "v_contract_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "v_payment_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "v_payment_due"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_reports: {
        Row: {
          created_at: string
          description: string | null
          id: string
          reporter_id: string | null
          severity: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          reporter_id?: string | null
          severity?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          reporter_id?: string | null
          severity?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "issue_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lookups: {
        Row: {
          category: string
          code: string
          created_at: string
          id: string
          is_active: boolean
          label: string
          sort_order: number
        }
        Insert: {
          category: string
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          sort_order?: number
        }
        Update: {
          category?: string
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      menus: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          is_active: boolean
          menu_key: string
          module_key: string | null
          page_key: string | null
          parent_id: string | null
          route: string | null
          sort_order: number
          title: string
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          menu_key: string
          module_key?: string | null
          page_key?: string | null
          parent_id?: string | null
          route?: string | null
          sort_order?: number
          title: string
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          menu_key?: string
          module_key?: string | null
          page_key?: string | null
          parent_id?: string | null
          route?: string | null
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "menus_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
        ]
      }
      milestones: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          due_date: string | null
          id: string
          note: string | null
          project_id: string
          sort_order: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          note?: string | null
          project_id: string
          sort_order?: number
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          note?: string | null
          project_id?: string
          sort_order?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "milestones_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_case_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_warranty_status"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          client_id: string | null
          code: string
          converted_project_id: string | null
          created_at: string
          created_by: string | null
          est_amount: number | null
          id: string
          next_action: string | null
          next_action_date: string | null
          note: string | null
          owner_id: string | null
          sort_order: number
          source: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          code: string
          converted_project_id?: string | null
          created_at?: string
          created_by?: string | null
          est_amount?: number | null
          id?: string
          next_action?: string | null
          next_action_date?: string | null
          note?: string | null
          owner_id?: string | null
          sort_order?: number
          source?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          code?: string
          converted_project_id?: string | null
          created_at?: string
          created_by?: string | null
          est_amount?: number | null
          id?: string
          next_action?: string | null
          next_action_date?: string | null
          note?: string | null
          owner_id?: string | null
          sort_order?: number
          source?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_payment_due"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "opportunities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_receivables_by_client"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "opportunities_converted_project_id_fkey"
            columns: ["converted_project_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_converted_project_id_fkey"
            columns: ["converted_project_id"]
            isOneToOne: false
            referencedRelation: "v_case_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_converted_project_id_fkey"
            columns: ["converted_project_id"]
            isOneToOne: false
            referencedRelation: "v_warranty_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          contract_id: string | null
          created_at: string
          created_by: string | null
          due_date: string | null
          id: string
          invoice_no: string | null
          invoice_status: string
          method: string | null
          note: string | null
          paid_date: string | null
          status: string
          title: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          invoice_no?: string | null
          invoice_status?: string
          method?: string | null
          note?: string | null
          paid_date?: string | null
          status?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          invoice_no?: string | null
          invoice_status?: string
          method?: string | null
          note?: string | null
          paid_date?: string | null
          status?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "v_contract_expiry_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "v_contract_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "v_payment_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          last_login_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          last_login_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          last_login_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_members: {
        Row: {
          created_at: string
          project_id: string
          role_in_project: string
          user_id: string
        }
        Insert: {
          created_at?: string
          project_id: string
          role_in_project?: string
          user_id: string
        }
        Update: {
          created_at?: string
          project_id?: string
          role_in_project?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_case_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_warranty_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_module_permissions: {
        Row: {
          can_create: boolean
          can_delete: boolean
          can_edit: boolean
          can_export: boolean
          can_view: boolean
          module_key: string
          role_id: string
        }
        Insert: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_export?: boolean
          can_view?: boolean
          module_key: string
          role_id: string
        }
        Update: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_export?: boolean
          can_view?: boolean
          module_key?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_module_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_page_permissions: {
        Row: {
          can_create: boolean | null
          can_delete: boolean | null
          can_edit: boolean | null
          can_export: boolean | null
          can_view: boolean | null
          page_key: string
          role_id: string
        }
        Insert: {
          can_create?: boolean | null
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_export?: boolean | null
          can_view?: boolean | null
          page_key: string
          role_id: string
        }
        Update: {
          can_create?: boolean | null
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_export?: boolean | null
          can_view?: boolean | null
          page_key?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_page_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name?: string
        }
        Relationships: []
      }
      service_tickets: {
        Row: {
          assignee_id: string | null
          billable: boolean | null
          client_id: string | null
          contract_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          note: string | null
          opened_at: string | null
          priority: string | null
          resolved_at: string | null
          responded_at: string | null
          spent_hours: number | null
          status: string | null
          system_id: string | null
          ticket_no: string | null
          title: string
          type: string | null
          updated_at: string | null
        }
        Insert: {
          assignee_id?: string | null
          billable?: boolean | null
          client_id?: string | null
          contract_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          note?: string | null
          opened_at?: string | null
          priority?: string | null
          resolved_at?: string | null
          responded_at?: string | null
          spent_hours?: number | null
          status?: string | null
          system_id?: string | null
          ticket_no?: string | null
          title: string
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          assignee_id?: string | null
          billable?: boolean | null
          client_id?: string | null
          contract_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          note?: string | null
          opened_at?: string | null
          priority?: string | null
          resolved_at?: string | null
          responded_at?: string | null
          spent_hours?: number | null
          status?: string | null
          system_id?: string | null
          ticket_no?: string | null
          title?: string
          type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_tickets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_tickets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_tickets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_payment_due"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "service_tickets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_receivables_by_client"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "service_tickets_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_tickets_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "v_contract_expiry_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_tickets_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "v_contract_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_tickets_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "v_payment_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_tickets_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_tickets_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "v_maintenance_alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      system_configs: {
        Row: {
          description: string | null
          group_name: string | null
          id: string
          key: string
          updated_at: string
          value: string | null
          value_type: string
        }
        Insert: {
          description?: string | null
          group_name?: string | null
          id?: string
          key: string
          updated_at?: string
          value?: string | null
          value_type?: string
        }
        Update: {
          description?: string | null
          group_name?: string | null
          id?: string
          key?: string
          updated_at?: string
          value?: string | null
          value_type?: string
        }
        Relationships: []
      }
      systems: {
        Row: {
          client_id: string | null
          code: string
          created_at: string
          created_by: string | null
          deploy_url: string | null
          github_repo: string | null
          id: string
          launch_date: string | null
          maintenance_due: string | null
          name: string
          note: string | null
          prod_url: string | null
          secrets_location: string | null
          status: string
          supabase_project: string | null
          tech_stack: string | null
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          deploy_url?: string | null
          github_repo?: string | null
          id?: string
          launch_date?: string | null
          maintenance_due?: string | null
          name: string
          note?: string | null
          prod_url?: string | null
          secrets_location?: string | null
          status?: string
          supabase_project?: string | null
          tech_stack?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          deploy_url?: string | null
          github_repo?: string | null
          id?: string
          launch_date?: string | null
          maintenance_due?: string | null
          name?: string
          note?: string | null
          prod_url?: string | null
          secrets_location?: string | null
          status?: string
          supabase_project?: string | null
          tech_stack?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "systems_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "systems_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "systems_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_payment_due"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "systems_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_receivables_by_client"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "systems_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          role_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wish_point_ledger: {
        Row: {
          balance: number
          change: number
          created_at: string
          id: string
          period: string
          reason: string | null
          ref_id: string | null
        }
        Insert: {
          balance: number
          change: number
          created_at?: string
          id?: string
          period: string
          reason?: string | null
          ref_id?: string | null
        }
        Update: {
          balance?: number
          change?: number
          created_at?: string
          id?: string
          period?: string
          reason?: string | null
          ref_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      v_case_summary: {
        Row: {
          amount: number | null
          client_name: string | null
          code: string | null
          due_date: string | null
          id: string | null
          member_count: number | null
          milestone_done: number | null
          milestone_total: number | null
          open_tasks: number | null
          overdue: boolean | null
          owner_name: string | null
          priority: string | null
          status: string | null
          title: string | null
        }
        Relationships: []
      }
      v_cashflow_forecast: {
        Row: {
          expected_in: number | null
          items: number | null
          month: string | null
        }
        Relationships: []
      }
      v_client_overview: {
        Row: {
          code: string | null
          contact_count: number | null
          contact_name: string | null
          contract_count: number | null
          contract_total: number | null
          email: string | null
          id: string | null
          last_contact_date: string | null
          name: string | null
          next_maintenance_due: string | null
          open_cases: number | null
          open_opps: number | null
          phone: string | null
          system_count: number | null
          tax_id: string | null
        }
        Insert: {
          code?: string | null
          contact_count?: never
          contact_name?: string | null
          contract_count?: never
          contract_total?: never
          email?: string | null
          id?: string | null
          last_contact_date?: never
          name?: string | null
          next_maintenance_due?: never
          open_cases?: never
          open_opps?: never
          phone?: string | null
          system_count?: never
          tax_id?: string | null
        }
        Update: {
          code?: string | null
          contact_count?: never
          contact_name?: string | null
          contract_count?: never
          contract_total?: never
          email?: string | null
          id?: string | null
          last_contact_date?: never
          name?: string | null
          next_maintenance_due?: never
          open_cases?: never
          open_opps?: never
          phone?: string | null
          system_count?: never
          tax_id?: string | null
        }
        Relationships: []
      }
      v_commission_by_person: {
        Row: {
          entries: number | null
          payee_id: string | null
          payee_name: string | null
          payout_period: string | null
          pending_amount: number | null
          realized_amount: number | null
          total_amount: number | null
        }
        Relationships: []
      }
      v_contract_expiry_alerts: {
        Row: {
          auto_renew: boolean | null
          client_id: string | null
          client_name: string | null
          contract_no: string | null
          contract_type: string | null
          days_to_end: number | null
          end_date: string | null
          id: string | null
          maintenance_period: string | null
          project_code: string | null
          project_id: string | null
          title: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_payment_due"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_receivables_by_client"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "contracts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_case_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_warranty_status"
            referencedColumns: ["id"]
          },
        ]
      }
      v_contract_summary: {
        Row: {
          auto_renew: boolean | null
          billing_type: string | null
          client_id: string | null
          client_name: string | null
          contract_amount: number | null
          contract_no: string | null
          contract_type: string | null
          days_to_end: number | null
          dev_fee: number | null
          end_date: string | null
          id: string | null
          invoice_status: string | null
          is_expiring: boolean | null
          maintenance_fee: number | null
          maintenance_period: string | null
          next_payment_date: string | null
          payment_status: string | null
          project_code: string | null
          project_id: string | null
          project_title: string | null
          signed_date: string | null
          start_date: string | null
          status: string | null
          system_code: string | null
          system_id: string | null
          system_name: string | null
          term_months: number | null
          title: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_payment_due"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_receivables_by_client"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "contracts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_case_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_warranty_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "v_maintenance_alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      v_maintenance_alerts: {
        Row: {
          client_name: string | null
          code: string | null
          days_left: number | null
          id: string | null
          maintenance_due: string | null
          maintenance_state: string | null
          name: string | null
        }
        Relationships: []
      }
      v_monthly_receipts: {
        Row: {
          month: string | null
          received: number | null
        }
        Relationships: []
      }
      v_open_tasks: {
        Row: {
          assignee_id: string | null
          assignee_name: string | null
          case_code: string | null
          case_title: string | null
          client_name: string | null
          days_left: number | null
          due_date: string | null
          id: string | null
          priority: string | null
          status: string | null
          title: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      v_payment_alerts: {
        Row: {
          billing_type: string | null
          days_left: number | null
          id: string | null
          next_payment_date: string | null
          payment_status: string | null
          system_code: string | null
          system_name: string | null
        }
        Relationships: []
      }
      v_payment_due: {
        Row: {
          amount: number | null
          client_id: string | null
          client_name: string | null
          days_left: number | null
          due_date: string | null
          id: string | null
          invoice_status: string | null
          status: string | null
          system_code: string | null
          system_name: string | null
          title: string | null
        }
        Relationships: []
      }
      v_project_tasks: {
        Row: {
          assignee_id: string | null
          assignee_name: string | null
          case_code: string | null
          case_id: string | null
          case_status: string | null
          case_title: string | null
          client_id: string | null
          client_name: string | null
          created_at: string | null
          description: string | null
          done_at: string | null
          due_date: string | null
          id: string | null
          overdue: boolean | null
          priority: string | null
          status: string | null
          title: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_tasks_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_tasks_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_tasks_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_warranty_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_payment_due"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "cases_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_receivables_by_client"
            referencedColumns: ["client_id"]
          },
        ]
      }
      v_receivables_by_client: {
        Row: {
          client_id: string | null
          code: string | null
          name: string | null
          outstanding: number | null
          overdue_amount: number | null
          received: number | null
        }
        Relationships: []
      }
      v_ticket_summary: {
        Row: {
          assignee_id: string | null
          billable: boolean | null
          client_id: string | null
          client_name: string | null
          contract_id: string | null
          id: string | null
          opened_at: string | null
          priority: string | null
          resolved_at: string | null
          responded_at: string | null
          sla_breached: boolean | null
          sla_due: string | null
          sla_hours: number | null
          spent_hours: number | null
          status: string | null
          system_code: string | null
          system_id: string | null
          system_name: string | null
          ticket_no: string | null
          title: string | null
          type: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_tickets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_tickets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_tickets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_payment_due"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "service_tickets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_receivables_by_client"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "service_tickets_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_tickets_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "v_contract_expiry_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_tickets_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "v_contract_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_tickets_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "v_payment_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_tickets_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_tickets_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "v_maintenance_alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      v_warranty_status: {
        Row: {
          acceptance_date: string | null
          client_id: string | null
          client_name: string | null
          code: string | null
          days_left: number | null
          expired: boolean | null
          has_active_maintenance: boolean | null
          id: string | null
          in_warranty: boolean | null
          title: string | null
          warranty_end: string | null
          warranty_months: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cases_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_payment_due"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "cases_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_receivables_by_client"
            referencedColumns: ["client_id"]
          },
        ]
      }
    }
    Functions: {
      convert_opportunity: { Args: { p_opp: string }; Returns: string }
      daily_maintenance: { Args: never; Returns: Json }
      gen_maintenance_payments: {
        Args: { p_contract: string }
        Returns: number
      }
      is_admin: { Args: never; Returns: boolean }
      redeem_invitation: { Args: { p_code: string }; Returns: string }
      user_can: {
        Args: { p_action: string; p_module: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
