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
      appointments: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          notes: string | null
          phone: string
          preferred_date: string
          service_type: string
          status: string
          time_slot: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name: string
          notes?: string | null
          phone: string
          preferred_date: string
          service_type: string
          status?: string
          time_slot: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          notes?: string | null
          phone?: string
          preferred_date?: string
          service_type?: string
          status?: string
          time_slot?: string
        }
        Relationships: []
      }
      contact_requests: {
        Row: {
          created_at: string
          email: string
          id: string
          is_read: boolean
          message: string
          name: string
          phone: string | null
          subject: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_read?: boolean
          message: string
          name: string
          phone?: string | null
          subject?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_read?: boolean
          message?: string
          name?: string
          phone?: string | null
          subject?: string | null
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      form_rate_limit: {
        Row: {
          client_ipv4: string | null
          created_at: string
          form_type: string
          id: string
          ip_address: string
          user_agent: string | null
        }
        Insert: {
          client_ipv4?: string | null
          created_at?: string
          form_type: string
          id?: string
          ip_address: string
          user_agent?: string | null
        }
        Update: {
          client_ipv4?: string | null
          created_at?: string
          form_type?: string
          id?: string
          ip_address?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      invoice_counter: {
        Row: {
          last_number: number
          updated_at: string
          year: number
        }
        Insert: {
          last_number?: number
          updated_at?: string
          year: number
        }
        Update: {
          last_number?: number
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      invoice_lines: {
        Row: {
          created_at: string
          description: string
          id: string
          invoice_id: string
          line_total_ht: number
          line_total_ttc: number
          line_total_tva: number
          position: number
          quantity: number
          tva: number
          type: string
          unit_price_ht: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          line_total_ht: number
          line_total_ttc: number
          line_total_tva: number
          position: number
          quantity: number
          tva: number
          type: string
          unit_price_ht: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          line_total_ht?: number
          line_total_ttc?: number
          line_total_tva?: number
          position?: number
          quantity?: number
          tva?: number
          type?: string
          unit_price_ht?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          artisan_snapshot: Json
          cancelled_at: string | null
          client_address: string
          client_email: string
          client_name: string
          client_phone: string | null
          created_at: string
          created_by: string
          email_artisan_error: string | null
          email_artisan_status: string
          email_client_error: string | null
          email_client_status: string
          generation_error: string | null
          id: string
          idempotency_key: string
          invoice_date: string
          invoice_number: string
          payload_fingerprint: string | null
          payment_method: string
          pdf_storage_path: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          total_ht: number
          total_ttc: number
          total_tva: number
          updated_at: string
        }
        Insert: {
          artisan_snapshot: Json
          cancelled_at?: string | null
          client_address: string
          client_email: string
          client_name: string
          client_phone?: string | null
          created_at?: string
          created_by: string
          email_artisan_error?: string | null
          email_artisan_status?: string
          email_client_error?: string | null
          email_client_status?: string
          generation_error?: string | null
          id?: string
          idempotency_key: string
          invoice_date: string
          invoice_number: string
          payload_fingerprint?: string | null
          payment_method: string
          pdf_storage_path?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          total_ht: number
          total_ttc: number
          total_tva: number
          updated_at?: string
        }
        Update: {
          artisan_snapshot?: Json
          cancelled_at?: string | null
          client_address?: string
          client_email?: string
          client_name?: string
          client_phone?: string | null
          created_at?: string
          created_by?: string
          email_artisan_error?: string | null
          email_artisan_status?: string
          email_client_error?: string | null
          email_client_status?: string
          generation_error?: string | null
          id?: string
          idempotency_key?: string
          invoice_date?: string
          invoice_number?: string
          payload_fingerprint?: string | null
          payment_method?: string
          pdf_storage_path?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          total_ht?: number
          total_ttc?: number
          total_tva?: number
          updated_at?: string
        }
        Relationships: []
      }
      quote_counter: {
        Row: {
          last_number: number
          updated_at: string
          year: number
        }
        Insert: {
          last_number?: number
          updated_at?: string
          year: number
        }
        Update: {
          last_number?: number
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      quote_lines: {
        Row: {
          created_at: string
          description: string
          id: string
          line_total_ht: number
          line_total_ttc: number
          line_total_tva: number
          position: number
          quantity: number
          quote_id: string
          tva: number
          type: string
          unit_price_ht: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          line_total_ht: number
          line_total_ttc: number
          line_total_tva: number
          position: number
          quantity: number
          quote_id: string
          tva: number
          type: string
          unit_price_ht: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          line_total_ht?: number
          line_total_ttc?: number
          line_total_tva?: number
          position?: number
          quantity?: number
          quote_id?: string
          tva?: number
          type?: string
          unit_price_ht?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_lines_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_requests: {
        Row: {
          address: string | null
          created_at: string
          description: string
          email: string
          id: string
          name: string
          phone: string
          service_type: string
          status: string
          urgency: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          description: string
          email: string
          id?: string
          name: string
          phone: string
          service_type: string
          status?: string
          urgency?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          description?: string
          email?: string
          id?: string
          name?: string
          phone?: string
          service_type?: string
          status?: string
          urgency?: string | null
        }
        Relationships: []
      }
      quotes: {
        Row: {
          artisan_snapshot: Json
          cancelled_at: string | null
          client_address: string
          client_email: string
          client_name: string
          client_phone: string | null
          created_at: string
          created_by: string
          email_artisan_error: string | null
          email_artisan_status: string
          email_client_error: string | null
          email_client_status: string
          generation_error: string | null
          id: string
          idempotency_key: string
          notes: string | null
          payload_fingerprint: string | null
          pdf_storage_path: string | null
          quote_date: string
          quote_number: string
          quote_request_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["quote_status"]
          total_ht: number
          total_ttc: number
          total_tva: number
          updated_at: string
          valid_until: string
        }
        Insert: {
          artisan_snapshot?: Json
          cancelled_at?: string | null
          client_address: string
          client_email: string
          client_name: string
          client_phone?: string | null
          created_at?: string
          created_by: string
          email_artisan_error?: string | null
          email_artisan_status?: string
          email_client_error?: string | null
          email_client_status?: string
          generation_error?: string | null
          id?: string
          idempotency_key: string
          notes?: string | null
          payload_fingerprint?: string | null
          pdf_storage_path?: string | null
          quote_date: string
          quote_number: string
          quote_request_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          total_ht?: number
          total_ttc?: number
          total_tva?: number
          updated_at?: string
          valid_until: string
        }
        Update: {
          artisan_snapshot?: Json
          cancelled_at?: string | null
          client_address?: string
          client_email?: string
          client_name?: string
          client_phone?: string | null
          created_at?: string
          created_by?: string
          email_artisan_error?: string | null
          email_artisan_status?: string
          email_client_error?: string | null
          email_client_status?: string
          generation_error?: string | null
          id?: string
          idempotency_key?: string
          notes?: string | null
          payload_fingerprint?: string | null
          pdf_storage_path?: string | null
          quote_date?: string
          quote_number?: string
          quote_request_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          total_ht?: number
          total_ttc?: number
          total_tva?: number
          updated_at?: string
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotes_quote_request_id_fkey"
            columns: ["quote_request_id"]
            isOneToOne: false
            referencedRelation: "quote_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_attachments: {
        Row: {
          created_at: string
          id: string
          mime_type: string
          original_filename: string
          request_id: string
          request_type: string
          size_bytes: number
          storage_path: string
        }
        Insert: {
          created_at?: string
          id?: string
          mime_type: string
          original_filename: string
          request_id: string
          request_type: string
          size_bytes: number
          storage_path: string
        }
        Update: {
          created_at?: string
          id?: string
          mime_type?: string
          original_filename?: string
          request_id?: string
          request_type?: string
          size_bytes?: number
          storage_path?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      uploaded_files: {
        Row: {
          confirmed_at: string | null
          created_at: string
          delete_attempts: number
          deleted_at: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          last_delete_error: string | null
          mime_type: string | null
          next_delete_retry_at: string | null
          original_filename: string
          owner_user_id: string | null
          reservation_expires_at: string | null
          size_bytes: number | null
          status: string
          storage_path: string
          temporary_storage_path: string | null
          upload_session_id: string
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string
          delete_attempts?: number
          deleted_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          last_delete_error?: string | null
          mime_type?: string | null
          next_delete_retry_at?: string | null
          original_filename: string
          owner_user_id?: string | null
          reservation_expires_at?: string | null
          size_bytes?: number | null
          status?: string
          storage_path: string
          temporary_storage_path?: string | null
          upload_session_id: string
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string
          delete_attempts?: number
          deleted_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          last_delete_error?: string | null
          mime_type?: string | null
          next_delete_retry_at?: string | null
          original_filename?: string
          owner_user_id?: string | null
          reservation_expires_at?: string | null
          size_bytes?: number | null
          status?: string
          storage_path?: string
          temporary_storage_path?: string | null
          upload_session_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_invoice_for_idempotency: {
        Args: {
          _artisan_snapshot: Json
          _client_address: string
          _client_email: string
          _client_name: string
          _client_phone: string
          _idempotency_key: string
          _invoice_date: string
          _payment_method: string
          _total_ht: number
          _total_ttc: number
          _total_tva: number
        }
        Returns: {
          invoice_id: string
          invoice_number: string
          reused: boolean
        }[]
      }
      create_invoice_with_lines_for_idempotency: {
        Args: {
          _artisan_snapshot: Json
          _client_address: string
          _client_email: string
          _client_name: string
          _client_phone: string
          _idempotency_key: string
          _invoice_date: string
          _lines: Json
          _payment_method: string
        }
        Returns: {
          invoice_id: string
          invoice_number: string
          reused: boolean
          total_ht: number
          total_ttc: number
          total_tva: number
        }[]
      }
      create_quote_for_idempotency: {
        Args: {
          _artisan_snapshot: Json
          _client_address: string
          _client_email: string
          _client_name: string
          _client_phone: string
          _idempotency_key: string
          _notes: string
          _quote_date: string
          _quote_request_id: string
          _total_ht: number
          _total_ttc: number
          _total_tva: number
          _valid_until: string
        }
        Returns: {
          quote_id: string
          quote_number: string
          reused: boolean
        }[]
      }
      create_quote_with_lines_for_idempotency: {
        Args: {
          _artisan_snapshot: Json
          _client_address: string
          _client_email: string
          _client_name: string
          _client_phone: string
          _idempotency_key: string
          _lines: Json
          _notes: string
          _quote_date: string
          _quote_request_id: string
          _valid_until: string
        }
        Returns: {
          quote_id: string
          quote_number: string
          reused: boolean
          total_ht: number
          total_ttc: number
          total_tva: number
        }[]
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      finalize_uploaded_file: {
        Args: {
          _entity_id: string
          _entity_type: string
          _file_id: string
          _final_path: string
          _legacy_request_type: string
          _temporary_path: string
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
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      next_invoice_number: { Args: never; Returns: string }
      normalize_document_lines: { Args: { _lines: Json }; Returns: Json }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      reserve_upload_files: {
        Args: {
          _files: Json
          _max_files?: number
          _ttl_minutes?: number
          _upload_session_id: string
        }
        Returns: {
          id: string
          storage_path: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
      invoice_status:
        | "generating"
        | "generation_failed"
        | "ready"
        | "sending"
        | "sent"
        | "partially_sent"
        | "send_failed"
        | "cancelled"
      quote_status:
        | "generating"
        | "generation_failed"
        | "ready"
        | "sending"
        | "sent"
        | "partially_sent"
        | "send_failed"
        | "accepted"
        | "refused"
        | "expired"
        | "cancelled"
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
      app_role: ["admin", "user"],
      invoice_status: [
        "generating",
        "generation_failed",
        "ready",
        "sending",
        "sent",
        "partially_sent",
        "send_failed",
        "cancelled",
      ],
      quote_status: [
        "generating",
        "generation_failed",
        "ready",
        "sending",
        "sent",
        "partially_sent",
        "send_failed",
        "accepted",
        "refused",
        "expired",
        "cancelled",
      ],
    },
  },
} as const
