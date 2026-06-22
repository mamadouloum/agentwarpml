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
      academic_years: {
        Row: {
          created_at: string
          ends_on: string
          id: string
          is_active: boolean
          name: string
          school_id: string
          starts_on: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_on: string
          id?: string
          is_active?: boolean
          name: string
          school_id: string
          starts_on: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_on?: string
          id?: string
          is_active?: boolean
          name?: string
          school_id?: string
          starts_on?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academic_years_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          audience: string
          author_id: string | null
          content: string
          created_at: string
          id: string
          published_at: string
          school_id: string
          title: string
          updated_at: string
        }
        Insert: {
          audience?: string
          author_id?: string | null
          content: string
          created_at?: string
          id?: string
          published_at?: string
          school_id: string
          title: string
          updated_at?: string
        }
        Update: {
          audience?: string
          author_id?: string | null
          content?: string
          created_at?: string
          id?: string
          published_at?: string
          school_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      attendances: {
        Row: {
          created_at: string
          date: string
          id: string
          reason: string | null
          recorded_by: string | null
          school_id: string
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
        }
        Insert: {
          created_at?: string
          date?: string
          id?: string
          reason?: string | null
          recorded_by?: string | null
          school_id: string
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          reason?: string | null
          recorded_by?: string | null
          school_id?: string
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendances_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendances_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendances_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      cantine_subscriptions: {
        Row: {
          created_at: string
          end_date: string | null
          formula: string
          id: string
          monthly_amount: number
          notes: string | null
          school_id: string
          start_date: string
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          formula: string
          id?: string
          monthly_amount?: number
          notes?: string | null
          school_id: string
          start_date?: string
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          formula?: string
          id?: string
          monthly_amount?: number
          notes?: string | null
          school_id?: string
          start_date?: string
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cantine_subscriptions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cantine_subscriptions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          academic_year: string
          created_at: string
          id: string
          level: string | null
          main_teacher_id: string | null
          name: string
          school_id: string
          updated_at: string
        }
        Insert: {
          academic_year: string
          created_at?: string
          id?: string
          level?: string | null
          main_teacher_id?: string | null
          name: string
          school_id: string
          updated_at?: string
        }
        Update: {
          academic_year?: string
          created_at?: string
          id?: string
          level?: string | null
          main_teacher_id?: string | null
          name?: string
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_main_teacher_id_fkey"
            columns: ["main_teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          description: string | null
          ends_at: string | null
          id: string
          location: string | null
          school_id: string
          starts_at: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          location?: string | null
          school_id: string
          starts_at: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          location?: string | null
          school_id?: string
          starts_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          school_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          school_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_categories_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          id: string
          label: string
          method: string | null
          note: string | null
          receipt_url: string | null
          recorded_by: string | null
          school_id: string
          spent_at: string
          supplier: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          id?: string
          label: string
          method?: string | null
          note?: string | null
          receipt_url?: string | null
          recorded_by?: string | null
          school_id: string
          spent_at?: string
          supplier?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          id?: string
          label?: string
          method?: string | null
          note?: string | null
          receipt_url?: string | null
          recorded_by?: string | null
          school_id?: string
          spent_at?: string
          supplier?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      grades: {
        Row: {
          academic_year_id: string | null
          comment: string | null
          created_at: string
          evaluation_type: string | null
          id: string
          max_score: number
          recorded_at: string
          school_id: string
          score: number
          student_id: string
          subject_id: string
          teacher_id: string | null
          term: string
        }
        Insert: {
          academic_year_id?: string | null
          comment?: string | null
          created_at?: string
          evaluation_type?: string | null
          id?: string
          max_score?: number
          recorded_at?: string
          school_id: string
          score: number
          student_id: string
          subject_id: string
          teacher_id?: string | null
          term: string
        }
        Update: {
          academic_year_id?: string | null
          comment?: string | null
          created_at?: string
          evaluation_type?: string | null
          id?: string
          max_score?: number
          recorded_at?: string
          school_id?: string
          score?: number
          student_id?: string
          subject_id?: string
          teacher_id?: string | null
          term?: string
        }
        Relationships: [
          {
            foreignKeyName: "grades_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      homework: {
        Row: {
          assigned_date: string
          attachment_url: string | null
          class_id: string
          created_at: string
          description: string | null
          due_date: string
          id: string
          school_id: string
          subject_id: string | null
          teacher_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_date?: string
          attachment_url?: string | null
          class_id: string
          created_at?: string
          description?: string | null
          due_date: string
          id?: string
          school_id: string
          subject_id?: string | null
          teacher_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_date?: string
          attachment_url?: string | null
          class_id?: string
          created_at?: string
          description?: string | null
          due_date?: string
          id?: string
          school_id?: string
          subject_id?: string | null
          teacher_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "homework_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          academic_year_id: string | null
          amount: number
          amount_paid: number
          created_at: string
          due_date: string | null
          id: string
          label: string
          school_id: string
          status: Database["public"]["Enums"]["payment_status"]
          student_id: string
          updated_at: string
        }
        Insert: {
          academic_year_id?: string | null
          amount: number
          amount_paid?: number
          created_at?: string
          due_date?: string | null
          id?: string
          label: string
          school_id: string
          status?: Database["public"]["Enums"]["payment_status"]
          student_id: string
          updated_at?: string
        }
        Update: {
          academic_year_id?: string | null
          amount?: number
          amount_paid?: number
          created_at?: string
          due_date?: string | null
          id?: string
          label?: string
          school_id?: string
          status?: Database["public"]["Enums"]["payment_status"]
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      library_books: {
        Row: {
          author: string | null
          available_qty: number
          category: string | null
          created_at: string
          id: string
          isbn: string | null
          school_id: string
          shelf: string | null
          title: string
          total_qty: number
          updated_at: string
        }
        Insert: {
          author?: string | null
          available_qty?: number
          category?: string | null
          created_at?: string
          id?: string
          isbn?: string | null
          school_id: string
          shelf?: string | null
          title: string
          total_qty?: number
          updated_at?: string
        }
        Update: {
          author?: string | null
          available_qty?: number
          category?: string | null
          created_at?: string
          id?: string
          isbn?: string | null
          school_id?: string
          shelf?: string | null
          title?: string
          total_qty?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_books_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      library_loans: {
        Row: {
          book_id: string
          created_at: string
          due_date: string
          id: string
          loan_date: string
          return_date: string | null
          school_id: string
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          book_id: string
          created_at?: string
          due_date: string
          id?: string
          loan_date?: string
          return_date?: string | null
          school_id: string
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          book_id?: string
          created_at?: string
          due_date?: string
          id?: string
          loan_date?: string
          return_date?: string | null
          school_id?: string
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_loans_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_loans_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_loans_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          created_at: string
          id: string
          read_at: string | null
          recipient_id: string | null
          school_id: string
          sender_id: string
          subject: string | null
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id?: string | null
          school_id: string
          sender_id: string
          subject?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id?: string | null
          school_id?: string
          sender_id?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_id: string
          method: string | null
          note: string | null
          paid_at: string
          recorded_by: string | null
          school_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          invoice_id: string
          method?: string | null
          note?: string | null
          paid_at?: string
          recorded_by?: string | null
          school_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string
          method?: string | null
          note?: string | null
          paid_at?: string
          recorded_by?: string | null
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          metadata: Json
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          first_name: string | null
          id: string
          last_name: string | null
          phone: string | null
          school_id: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          first_name?: string | null
          id: string
          last_name?: string | null
          phone?: string | null
          school_id?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          school_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          can_read: boolean
          can_write: boolean
          created_at: string
          id: string
          module: string
          updated_at: string
          user_role_id: string
        }
        Insert: {
          can_read?: boolean
          can_write?: boolean
          created_at?: string
          id?: string
          module: string
          updated_at?: string
          user_role_id: string
        }
        Update: {
          can_read?: boolean
          can_write?: boolean
          created_at?: string
          id?: string
          module?: string
          updated_at?: string
          user_role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_user_role_id_fkey"
            columns: ["user_role_id"]
            isOneToOne: false
            referencedRelation: "user_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      schedules: {
        Row: {
          class_id: string
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          room: string | null
          school_id: string
          start_time: string
          subject_id: string | null
          teacher_id: string | null
        }
        Insert: {
          class_id: string
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          room?: string | null
          school_id: string
          start_time: string
          subject_id?: string | null
          teacher_id?: string | null
        }
        Update: {
          class_id?: string
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          room?: string | null
          school_id?: string
          start_time?: string
          subject_id?: string | null
          teacher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedules_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      school_branding: {
        Row: {
          accent_color: string
          button_color: string | null
          created_at: string
          logo_url: string | null
          motto: string | null
          primary_color: string
          school_id: string
          secondary_color: string
          updated_at: string
        }
        Insert: {
          accent_color?: string
          button_color?: string | null
          created_at?: string
          logo_url?: string | null
          motto?: string | null
          primary_color?: string
          school_id: string
          secondary_color?: string
          updated_at?: string
        }
        Update: {
          accent_color?: string
          button_color?: string | null
          created_at?: string
          logo_url?: string | null
          motto?: string | null
          primary_color?: string
          school_id?: string
          secondary_color?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_branding_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_subscriptions: {
        Row: {
          amount: number
          canceled_at: string | null
          created_at: string
          currency: string
          current_period_end: string
          current_period_start: string
          id: string
          plan: Database["public"]["Enums"]["subscription_plan"]
          school_id: string
          started_at: string
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
        }
        Insert: {
          amount?: number
          canceled_at?: string | null
          created_at?: string
          currency?: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          school_id: string
          started_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          canceled_at?: string | null
          created_at?: string
          currency?: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          school_id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_subscriptions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          address: string | null
          code: string
          created_at: string
          email: string | null
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          status: Database["public"]["Enums"]["school_status"]
          updated_at: string
        }
        Insert: {
          address?: string | null
          code: string
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          name: string
          phone?: string | null
          status?: Database["public"]["Enums"]["school_status"]
          updated_at?: string
        }
        Update: {
          address?: string | null
          code?: string
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          status?: Database["public"]["Enums"]["school_status"]
          updated_at?: string
        }
        Relationships: []
      }
      seating_assignments: {
        Row: {
          col: number
          created_at: string
          id: string
          plan_id: string
          row: number
          student_id: string
        }
        Insert: {
          col: number
          created_at?: string
          id?: string
          plan_id: string
          row: number
          student_id: string
        }
        Update: {
          col?: number
          created_at?: string
          id?: string
          plan_id?: string
          row?: number
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seating_assignments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "seating_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seating_assignments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      seating_plans: {
        Row: {
          class_id: string
          cols: number
          created_at: string
          id: string
          name: string
          rows: number
          school_id: string
          updated_at: string
        }
        Insert: {
          class_id: string
          cols?: number
          created_at?: string
          id?: string
          name: string
          rows?: number
          school_id: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          cols?: number
          created_at?: string
          id?: string
          name?: string
          rows?: number
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seating_plans_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seating_plans_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      student_parents: {
        Row: {
          created_at: string
          id: string
          parent_user_id: string
          school_id: string
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          parent_user_id: string
          school_id: string
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          parent_user_id?: string
          school_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_parents_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_parents_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          birth_date: string | null
          class_id: string | null
          created_at: string
          enrolled_at: string
          first_name: string
          gender: Database["public"]["Enums"]["gender"] | null
          id: string
          last_name: string
          matricule: string
          parent_email: string | null
          parent_id: string | null
          parent_name: string | null
          parent_phone: string | null
          photo_url: string | null
          school_id: string
          student_user_id: string | null
          updated_at: string
        }
        Insert: {
          birth_date?: string | null
          class_id?: string | null
          created_at?: string
          enrolled_at?: string
          first_name: string
          gender?: Database["public"]["Enums"]["gender"] | null
          id?: string
          last_name: string
          matricule: string
          parent_email?: string | null
          parent_id?: string | null
          parent_name?: string | null
          parent_phone?: string | null
          photo_url?: string | null
          school_id: string
          student_user_id?: string | null
          updated_at?: string
        }
        Update: {
          birth_date?: string | null
          class_id?: string | null
          created_at?: string
          enrolled_at?: string
          first_name?: string
          gender?: Database["public"]["Enums"]["gender"] | null
          id?: string
          last_name?: string
          matricule?: string
          parent_email?: string | null
          parent_id?: string | null
          parent_name?: string | null
          parent_phone?: string | null
          photo_url?: string | null
          school_id?: string
          student_user_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          code: string | null
          coefficient: number
          created_at: string
          id: string
          name: string
          school_id: string
        }
        Insert: {
          code?: string | null
          coefficient?: number
          created_at?: string
          id?: string
          name: string
          school_id: string
        }
        Update: {
          code?: string | null
          coefficient?: number
          created_at?: string
          id?: string
          name?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subjects_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_invoices: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          method: string | null
          paid_at: string
          period_end: string | null
          period_start: string | null
          plan: Database["public"]["Enums"]["subscription_plan"]
          reference: string | null
          school_id: string
          status: string
          subscription_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          method?: string | null
          paid_at?: string
          period_end?: string | null
          period_start?: string | null
          plan: Database["public"]["Enums"]["subscription_plan"]
          reference?: string | null
          school_id: string
          status?: string
          subscription_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          method?: string | null
          paid_at?: string
          period_end?: string | null
          period_start?: string | null
          plan?: Database["public"]["Enums"]["subscription_plan"]
          reference?: string | null
          school_id?: string
          status?: string
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_invoices_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "school_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_assignments: {
        Row: {
          class_id: string
          created_at: string
          id: string
          school_id: string
          subject_id: string | null
          teacher_user_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          school_id: string
          subject_id?: string | null
          teacher_user_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          school_id?: string
          subject_id?: string | null
          teacher_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_assignments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_assignments_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_routes: {
        Row: {
          capacity: number
          created_at: string
          description: string | null
          driver_name: string | null
          driver_phone: string | null
          id: string
          monthly_fee: number
          name: string
          school_id: string
          updated_at: string
          vehicle_plate: string | null
        }
        Insert: {
          capacity?: number
          created_at?: string
          description?: string | null
          driver_name?: string | null
          driver_phone?: string | null
          id?: string
          monthly_fee?: number
          name: string
          school_id: string
          updated_at?: string
          vehicle_plate?: string | null
        }
        Update: {
          capacity?: number
          created_at?: string
          description?: string | null
          driver_name?: string | null
          driver_phone?: string | null
          id?: string
          monthly_fee?: number
          name?: string
          school_id?: string
          updated_at?: string
          vehicle_plate?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transport_routes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_subscriptions: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          monthly_amount: number
          pickup_point: string | null
          route_id: string
          school_id: string
          start_date: string
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          monthly_amount?: number
          pickup_point?: string | null
          route_id: string
          school_id: string
          start_date?: string
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          monthly_amount?: number
          pickup_point?: string | null
          route_id?: string
          school_id?: string
          start_date?: string
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transport_subscriptions_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "transport_routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_subscriptions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_subscriptions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          school_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          school_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          school_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_school_id: { Args: never; Returns: string }
      find_user_by_email: {
        Args: { _email: string }
        Returns: {
          id: string
        }[]
      }
      has_module_permission: {
        Args: {
          _module: string
          _need_write?: boolean
          _school_id: string
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_school_admin: { Args: { _school_id: string }; Returns: boolean }
      is_school_member: { Args: { _school_id: string }; Returns: boolean }
      is_student_parent: { Args: { _student_id: string }; Returns: boolean }
      teaches_class: { Args: { _class_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "school_admin"
        | "teacher"
        | "parent"
        | "student"
        | "staff"
      attendance_status: "present" | "absent" | "late" | "excused"
      gender: "M" | "F"
      payment_status: "pending" | "partial" | "paid" | "overdue"
      school_status: "active" | "suspended" | "expired"
      subscription_plan: "starter" | "pro" | "enterprise"
      subscription_status: "trialing" | "active" | "past_due" | "canceled"
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
    Enums: {
      app_role: [
        "super_admin",
        "school_admin",
        "teacher",
        "parent",
        "student",
        "staff",
      ],
      attendance_status: ["present", "absent", "late", "excused"],
      gender: ["M", "F"],
      payment_status: ["pending", "partial", "paid", "overdue"],
      school_status: ["active", "suspended", "expired"],
      subscription_plan: ["starter", "pro", "enterprise"],
      subscription_status: ["trialing", "active", "past_due", "canceled"],
    },
  },
} as const
