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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      admin_activity: {
        Row: {
          action: string
          admin_user_id: string
          created_at: string
          details: Json | null
          id: string
          ip_address: unknown
          target_tenant_id: string | null
          target_user_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          admin_user_id: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: unknown
          target_tenant_id?: string | null
          target_user_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          admin_user_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: unknown
          target_tenant_id?: string | null
          target_user_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      alert_events: {
        Row: {
          alert_id: string | null
          data: Json | null
          id: string
          triggered_at: string | null
        }
        Insert: {
          alert_id?: string | null
          data?: Json | null
          id?: string
          triggered_at?: string | null
        }
        Update: {
          alert_id?: string | null
          data?: Json | null
          id?: string
          triggered_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alert_events_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          condition: Json
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          tenant_id: string | null
          type: string
        }
        Insert: {
          condition: Json
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          tenant_id?: string | null
          type: string
        }
        Update: {
          condition?: Json
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          tenant_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          allowed_operations: Json | null
          created_at: string | null
          expires_at: string | null
          hashed_key: string
          id: string
          ip_allowlist: Json | null
          is_active: boolean | null
          key_type: Database["public"]["Enums"]["api_key_type"]
          last_used_at: string | null
          name: string
          prefix: string
          rate_limit_tier: string | null
          revoked_at: string | null
          scope: Json | null
          status: string | null
          tenant_id: string
        }
        Insert: {
          allowed_operations?: Json | null
          created_at?: string | null
          expires_at?: string | null
          hashed_key: string
          id?: string
          ip_allowlist?: Json | null
          is_active?: boolean | null
          key_type: Database["public"]["Enums"]["api_key_type"]
          last_used_at?: string | null
          name: string
          prefix: string
          rate_limit_tier?: string | null
          revoked_at?: string | null
          scope?: Json | null
          status?: string | null
          tenant_id: string
        }
        Update: {
          allowed_operations?: Json | null
          created_at?: string | null
          expires_at?: string | null
          hashed_key?: string
          id?: string
          ip_allowlist?: Json | null
          is_active?: boolean | null
          key_type?: Database["public"]["Enums"]["api_key_type"]
          last_used_at?: string | null
          name?: string
          prefix?: string
          rate_limit_tier?: string | null
          revoked_at?: string | null
          scope?: Json | null
          status?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      approvals: {
        Row: {
          action_data: Json
          action_type: string
          created_at: string
          expires_at: string | null
          id: string
          requested_by: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          action_data: Json
          action_type: string
          created_at?: string
          expires_at?: string | null
          id?: string
          requested_by: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          action_data?: Json
          action_type?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          requested_by?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          after: Json | null
          before: Json | null
          created_at: string | null
          id: string
          ip: string | null
          target: string | null
          tenant_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string | null
          id?: string
          ip?: string | null
          target?: string | null
          tenant_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string | null
          id?: string
          ip?: string | null
          target?: string | null
          tenant_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      checkout_sessions: {
        Row: {
          amount: number
          created_at: string | null
          currency: string
          expires_at: string | null
          id: string
          method_types: Json
          provider: string | null
          provider_session_id: string | null
          qr_image_url: string | null
          redirect_url: string | null
          reference: string | null
          status: string
          tenant_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency: string
          expires_at?: string | null
          id?: string
          method_types: Json
          provider?: string | null
          provider_session_id?: string | null
          qr_image_url?: string | null
          redirect_url?: string | null
          reference?: string | null
          status?: string
          tenant_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string
          expires_at?: string | null
          id?: string
          method_types?: Json
          provider?: string | null
          provider_session_id?: string | null
          qr_image_url?: string | null
          redirect_url?: string | null
          reference?: string | null
          status?: string
          tenant_id?: string | null
        }
        Relationships: []
      }
      csrf_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      customer_bank_accounts: {
        Row: {
          account_holder: string | null
          account_number: string
          bank_code: string
          bank_name: string
          bank_short_name: string
          company_code: string | null
          created_at: string | null
          deposit_enabled: boolean | null
          id: string
          notes: string | null
          password: string | null
          password_visible: boolean | null
          public_id: string | null
          status: string | null
          updated_at: string | null
          withdrawal_enabled: boolean | null
        }
        Insert: {
          account_holder?: string | null
          account_number: string
          bank_code: string
          bank_name: string
          bank_short_name: string
          company_code?: string | null
          created_at?: string | null
          deposit_enabled?: boolean | null
          id?: string
          notes?: string | null
          password?: string | null
          password_visible?: boolean | null
          public_id?: string | null
          status?: string | null
          updated_at?: string | null
          withdrawal_enabled?: boolean | null
        }
        Update: {
          account_holder?: string | null
          account_number?: string
          bank_code?: string
          bank_name?: string
          bank_short_name?: string
          company_code?: string | null
          created_at?: string | null
          deposit_enabled?: boolean | null
          id?: string
          notes?: string | null
          password?: string | null
          password_visible?: boolean | null
          public_id?: string | null
          status?: string | null
          updated_at?: string | null
          withdrawal_enabled?: boolean | null
        }
        Relationships: []
      }
      customer_settings: {
        Row: {
          api_customer_key: string
          api_secret_key: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          api_customer_key: string
          api_secret_key: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          api_customer_key?: string
          api_secret_key?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          created_at: string | null
          email: string
          id: string
          metadata: Json | null
          name: string | null
          tenant_id: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          metadata?: Json | null
          name?: string | null
          tenant_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          metadata?: Json | null
          name?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      deposit_transfers: {
        Row: {
          adminbank_bankaccountcode: string | null
          adminbank_bankcode: string | null
          adminbank_bankname: string | null
          afterdepositamt: number | null
          amountpaid: number | null
          bankcode: string | null
          beforedepositamt: number | null
          cashtype: string | null
          created_at: string | null
          created_by: string | null
          createdate: string | null
          custaccountname: string | null
          custaccountnumber: string | null
          custphonenumber: string | null
          depositdate: string | null
          deposittid: string | null
          fullname: string | null
          id: number
          memberid: string | null
          note: string | null
          providerid: string | null
          ref_id: string
          remark: string | null
          status: string | null
          statusprocess: boolean | null
          transactionid: string | null
          updated_at: string | null
          updated_by: string | null
          updatedate: string | null
          username: string | null
        }
        Insert: {
          adminbank_bankaccountcode?: string | null
          adminbank_bankcode?: string | null
          adminbank_bankname?: string | null
          afterdepositamt?: number | null
          amountpaid?: number | null
          bankcode?: string | null
          beforedepositamt?: number | null
          cashtype?: string | null
          created_at?: string | null
          created_by?: string | null
          createdate?: string | null
          custaccountname?: string | null
          custaccountnumber?: string | null
          custphonenumber?: string | null
          depositdate?: string | null
          deposittid?: string | null
          fullname?: string | null
          id?: number
          memberid?: string | null
          note?: string | null
          providerid?: string | null
          ref_id: string
          remark?: string | null
          status?: string | null
          statusprocess?: boolean | null
          transactionid?: string | null
          updated_at?: string | null
          updated_by?: string | null
          updatedate?: string | null
          username?: string | null
        }
        Update: {
          adminbank_bankaccountcode?: string | null
          adminbank_bankcode?: string | null
          adminbank_bankname?: string | null
          afterdepositamt?: number | null
          amountpaid?: number | null
          bankcode?: string | null
          beforedepositamt?: number | null
          cashtype?: string | null
          created_at?: string | null
          created_by?: string | null
          createdate?: string | null
          custaccountname?: string | null
          custaccountnumber?: string | null
          custphonenumber?: string | null
          depositdate?: string | null
          deposittid?: string | null
          fullname?: string | null
          id?: number
          memberid?: string | null
          note?: string | null
          providerid?: string | null
          ref_id?: string
          remark?: string | null
          status?: string | null
          statusprocess?: boolean | null
          transactionid?: string | null
          updated_at?: string | null
          updated_by?: string | null
          updatedate?: string | null
          username?: string | null
        }
        Relationships: []
      }
      disputes: {
        Row: {
          amount: number
          created_at: string | null
          currency: string
          due_at: string | null
          evidence_url: string | null
          id: string
          metadata: Json | null
          payment_id: string
          reason: string | null
          stage: string
          status: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency: string
          due_at?: string | null
          evidence_url?: string | null
          id?: string
          metadata?: Json | null
          payment_id: string
          reason?: string | null
          stage?: string
          status?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string
          due_at?: string | null
          evidence_url?: string | null
          id?: string
          metadata?: Json | null
          payment_id?: string
          reason?: string | null
          stage?: string
          status?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      encryption_keys: {
        Row: {
          created_at: string | null
          id: string
          key_name: string
          key_value: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          key_name: string
          key_value: string
        }
        Update: {
          created_at?: string | null
          id?: string
          key_name?: string
          key_value?: string
        }
        Relationships: []
      }
      go_live_checklist: {
        Row: {
          completed: boolean | null
          completed_at: string | null
          created_at: string | null
          id: string
          item: string
          tenant_id: string | null
        }
        Insert: {
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          item: string
          tenant_id?: string | null
        }
        Update: {
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          item?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "go_live_checklist_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      guardrails: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          rule_config: Json
          rule_type: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          rule_config: Json
          rule_type: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          rule_config?: Json
          rule_type?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guardrails_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      hmac_replay_cache: {
        Row: {
          created_at: string | null
          id: string
          platform_id: string
          signature_hash: string
          timestamp: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          platform_id: string
          signature_hash: string
          timestamp: string
        }
        Update: {
          created_at?: string | null
          id?: string
          platform_id?: string
          signature_hash?: string
          timestamp?: string
        }
        Relationships: []
      }
      id_sequences: {
        Row: {
          current_value: number
          id: string
          prefix: string
          updated_at: string
        }
        Insert: {
          current_value?: number
          id?: string
          prefix: string
          updated_at?: string
        }
        Update: {
          current_value?: number
          id?: string
          prefix?: string
          updated_at?: string
        }
        Relationships: []
      }
      idempotency_keys: {
        Row: {
          created_at: string | null
          id: string
          key: string
          response: Json | null
          tenant_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          key: string
          response?: Json | null
          tenant_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          key?: string
          response?: Json | null
          tenant_id?: string | null
        }
        Relationships: []
      }
      incoming_transfers: {
        Row: {
          adminbank_id: string | null
          amount: number | null
          bank_code: string | null
          created_at: string | null
          from_account: string | null
          from_name: string | null
          id: string
          raw: Json
          ref_id: string | null
          slip_bank_from: string | null
          slip_bank_to: string | null
          status: string | null
          to_account: string | null
          to_name: string | null
          trans_name_th: string | null
          txn_time: string | null
          updated_at: string | null
        }
        Insert: {
          adminbank_id?: string | null
          amount?: number | null
          bank_code?: string | null
          created_at?: string | null
          from_account?: string | null
          from_name?: string | null
          id: string
          raw: Json
          ref_id?: string | null
          slip_bank_from?: string | null
          slip_bank_to?: string | null
          status?: string | null
          to_account?: string | null
          to_name?: string | null
          trans_name_th?: string | null
          txn_time?: string | null
          updated_at?: string | null
        }
        Update: {
          adminbank_id?: string | null
          amount?: number | null
          bank_code?: string | null
          created_at?: string | null
          from_account?: string | null
          from_name?: string | null
          id?: string
          raw?: Json
          ref_id?: string | null
          slip_bank_from?: string | null
          slip_bank_to?: string | null
          status?: string | null
          to_account?: string | null
          to_name?: string | null
          trans_name_th?: string | null
          txn_time?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      ip_blocks: {
        Row: {
          blocked_at: string
          blocked_by: string | null
          blocked_until: string | null
          created_at: string | null
          id: string
          ip_address: unknown
          is_permanent: boolean | null
          last_violation_at: string
          metadata: Json | null
          reason: string
          updated_at: string | null
          violation_count: number
        }
        Insert: {
          blocked_at?: string
          blocked_by?: string | null
          blocked_until?: string | null
          created_at?: string | null
          id?: string
          ip_address: unknown
          is_permanent?: boolean | null
          last_violation_at?: string
          metadata?: Json | null
          reason: string
          updated_at?: string | null
          violation_count?: number
        }
        Update: {
          blocked_at?: string
          blocked_by?: string | null
          blocked_until?: string | null
          created_at?: string | null
          id?: string
          ip_address?: unknown
          is_permanent?: boolean | null
          last_violation_at?: string
          metadata?: Json | null
          reason?: string
          updated_at?: string | null
          violation_count?: number
        }
        Relationships: []
      }
      kyc_documents: {
        Row: {
          created_at: string
          document_number: string | null
          document_type: Database["public"]["Enums"]["kyc_document_type"]
          document_url: string | null
          expiry_date: string | null
          id: string
          metadata: Json | null
          rejection_reason: string | null
          status: Database["public"]["Enums"]["kyc_verification_status"]
          tenant_id: string
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          document_number?: string | null
          document_type: Database["public"]["Enums"]["kyc_document_type"]
          document_url?: string | null
          expiry_date?: string | null
          id?: string
          metadata?: Json | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["kyc_verification_status"]
          tenant_id: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          document_number?: string | null
          document_type?: Database["public"]["Enums"]["kyc_document_type"]
          document_url?: string | null
          expiry_date?: string | null
          id?: string
          metadata?: Json | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["kyc_verification_status"]
          tenant_id?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kyc_documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string | null
          id: string
          role_id: string
          status: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role_id: string
          status?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role_id?: string
          status?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_links: {
        Row: {
          amount: number
          created_at: string | null
          currency: string
          expires_at: string | null
          id: string
          reference: string | null
          slug: string
          status: string | null
          tenant_id: string | null
          usage_limit: number | null
          used_count: number | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency: string
          expires_at?: string | null
          id?: string
          reference?: string | null
          slug: string
          status?: string | null
          tenant_id?: string | null
          usage_limit?: number | null
          used_count?: number | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string
          expires_at?: string | null
          id?: string
          reference?: string | null
          slug?: string
          status?: string | null
          tenant_id?: string | null
          usage_limit?: number | null
          used_count?: number | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          bank_account_name: string | null
          bank_account_number: string | null
          bank_name: string | null
          checkout_session_id: string | null
          created_at: string | null
          currency: string
          id: string
          metadata: Json | null
          method: string | null
          paid_at: string | null
          provider: string | null
          provider_payment_id: string | null
          reconciled_at: string | null
          reconciliation_status: string | null
          settlement_id: string | null
          status: string
          tenant_id: string | null
          type: string | null
          withdrawal_notes: string | null
        }
        Insert: {
          amount: number
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          checkout_session_id?: string | null
          created_at?: string | null
          currency: string
          id?: string
          metadata?: Json | null
          method?: string | null
          paid_at?: string | null
          provider?: string | null
          provider_payment_id?: string | null
          reconciled_at?: string | null
          reconciliation_status?: string | null
          settlement_id?: string | null
          status: string
          tenant_id?: string | null
          type?: string | null
          withdrawal_notes?: string | null
        }
        Update: {
          amount?: number
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          checkout_session_id?: string | null
          created_at?: string | null
          currency?: string
          id?: string
          metadata?: Json | null
          method?: string | null
          paid_at?: string | null
          provider?: string | null
          provider_payment_id?: string | null
          reconciled_at?: string | null
          reconciliation_status?: string | null
          settlement_id?: string | null
          status?: string
          tenant_id?: string | null
          type?: string | null
          withdrawal_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      platform_provider_credentials: {
        Row: {
          created_at: string
          created_by: string | null
          feature_flags: Json | null
          id: string
          last_rotated_at: string | null
          merchant_id: string | null
          mode: string
          provider: string
          public_key: string | null
          secret_key: string | null
          updated_at: string
          webhook_secret: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          feature_flags?: Json | null
          id?: string
          last_rotated_at?: string | null
          merchant_id?: string | null
          mode: string
          provider: string
          public_key?: string | null
          secret_key?: string | null
          updated_at?: string
          webhook_secret?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          feature_flags?: Json | null
          id?: string
          last_rotated_at?: string | null
          merchant_id?: string | null
          mode?: string
          provider?: string
          public_key?: string | null
          secret_key?: string | null
          updated_at?: string
          webhook_secret?: string | null
        }
        Relationships: []
      }
      platform_provisioning_tokens: {
        Row: {
          allowed_tenants: Json | null
          created_at: string | null
          created_by: string | null
          hashed_secret: string
          id: string
          ip_allowlist: Json | null
          last_used_at: string | null
          notes: string | null
          platform_id: string
          platform_name: string
          revoked_at: string | null
          status: string | null
        }
        Insert: {
          allowed_tenants?: Json | null
          created_at?: string | null
          created_by?: string | null
          hashed_secret: string
          id?: string
          ip_allowlist?: Json | null
          last_used_at?: string | null
          notes?: string | null
          platform_id: string
          platform_name: string
          revoked_at?: string | null
          status?: string | null
        }
        Update: {
          allowed_tenants?: Json | null
          created_at?: string | null
          created_by?: string | null
          hashed_secret?: string
          id?: string
          ip_allowlist?: Json | null
          last_used_at?: string | null
          notes?: string | null
          platform_id?: string
          platform_name?: string
          revoked_at?: string | null
          status?: string | null
        }
        Relationships: []
      }
      platform_security_policy: {
        Row: {
          created_at: string
          default_require_2fa_for_admin: boolean
          default_require_2fa_for_owner: boolean
          default_stepup_window_seconds: number
          first_login_require_mfa: boolean | null
          first_login_require_password_change: boolean | null
          force_2fa_for_all_roles: boolean | null
          force_2fa_for_super_admin: boolean
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_require_2fa_for_admin?: boolean
          default_require_2fa_for_owner?: boolean
          default_stepup_window_seconds?: number
          first_login_require_mfa?: boolean | null
          first_login_require_password_change?: boolean | null
          force_2fa_for_all_roles?: boolean | null
          force_2fa_for_super_admin?: boolean
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_require_2fa_for_admin?: boolean
          default_require_2fa_for_owner?: boolean
          default_stepup_window_seconds?: number
          first_login_require_mfa?: boolean | null
          first_login_require_password_change?: boolean | null
          force_2fa_for_all_roles?: boolean | null
          force_2fa_for_super_admin?: boolean
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          setting_key: string
          setting_value?: Json
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_super_admin: boolean | null
          public_id: string | null
          requires_password_change: boolean | null
          totp_backup_codes: string[] | null
          totp_enabled: boolean | null
          totp_secret: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_super_admin?: boolean | null
          public_id?: string | null
          requires_password_change?: boolean | null
          totp_backup_codes?: string[] | null
          totp_enabled?: boolean | null
          totp_secret?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_super_admin?: boolean | null
          public_id?: string | null
          requires_password_change?: boolean | null
          totp_backup_codes?: string[] | null
          totp_enabled?: boolean | null
          totp_secret?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      provider_events: {
        Row: {
          event_id: string
          id: string
          payload: Json
          provider: string
          received_at: string | null
          type: string
        }
        Insert: {
          event_id: string
          id?: string
          payload: Json
          provider: string
          received_at?: string | null
          type: string
        }
        Update: {
          event_id?: string
          id?: string
          payload?: Json
          provider?: string
          received_at?: string | null
          type?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          count: number
          created_at: string | null
          endpoint: string
          id: string
          identifier: string
          window_start: string
        }
        Insert: {
          count?: number
          created_at?: string | null
          endpoint: string
          id?: string
          identifier: string
          window_start: string
        }
        Update: {
          count?: number
          created_at?: string | null
          endpoint?: string
          id?: string
          identifier?: string
          window_start?: string
        }
        Relationships: []
      }
      refunds: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          payment_id: string | null
          provider_refund_id: string | null
          reason: string | null
          status: string
          tenant_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          payment_id?: string | null
          provider_refund_id?: string | null
          reason?: string | null
          status?: string
          tenant_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          payment_id?: string | null
          provider_refund_id?: string | null
          reason?: string | null
          status?: string
          tenant_id?: string | null
        }
        Relationships: []
      }
      role_assignments_log: {
        Row: {
          action: string
          assigned_by: string | null
          created_at: string
          id: string
          previous_role_id: string | null
          reason: string | null
          role_id: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          action: string
          assigned_by?: string | null
          created_at?: string
          id?: string
          previous_role_id?: string | null
          reason?: string | null
          role_id: string
          tenant_id: string
          user_id: string
        }
        Update: {
          action?: string
          assigned_by?: string | null
          created_at?: string
          id?: string
          previous_role_id?: string | null
          reason?: string | null
          role_id?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_system: boolean | null
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean | null
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean | null
          name?: string
        }
        Relationships: []
      }
      roles: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      security_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_type: string
          created_at: string | null
          description: string
          event_count: number | null
          first_seen_at: string | null
          id: string
          last_seen_at: string | null
          metadata: Json | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          status: string | null
          tenant_id: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type: string
          created_at?: string | null
          description: string
          event_count?: number | null
          first_seen_at?: string | null
          id?: string
          last_seen_at?: string | null
          metadata?: Json | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity: string
          status?: string | null
          tenant_id?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type?: string
          created_at?: string | null
          description?: string
          event_count?: number | null
          first_seen_at?: string | null
          id?: string
          last_seen_at?: string | null
          metadata?: Json | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string | null
          tenant_id?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_alerts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      security_events: {
        Row: {
          blocked: boolean | null
          created_at: string | null
          endpoint: string | null
          event_data: Json | null
          event_type: string
          id: string
          ip_address: unknown
          request_id: string | null
          severity: string
          tenant_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          blocked?: boolean | null
          created_at?: string | null
          endpoint?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          ip_address?: unknown
          request_id?: string | null
          severity: string
          tenant_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          blocked?: boolean | null
          created_at?: string | null
          endpoint?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          ip_address?: unknown
          request_id?: string | null
          severity?: string
          tenant_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      security_metrics: {
        Row: {
          blocked_requests: number | null
          created_at: string | null
          csrf_violations: number | null
          failed_login_attempts: number | null
          id: string
          metric_date: string
          mfa_failures: number | null
          rate_limit_violations: number | null
          suspicious_api_calls: number | null
          tenant_id: string | null
          unique_attackers: number | null
          updated_at: string | null
        }
        Insert: {
          blocked_requests?: number | null
          created_at?: string | null
          csrf_violations?: number | null
          failed_login_attempts?: number | null
          id?: string
          metric_date: string
          mfa_failures?: number | null
          rate_limit_violations?: number | null
          suspicious_api_calls?: number | null
          tenant_id?: string | null
          unique_attackers?: number | null
          updated_at?: string | null
        }
        Update: {
          blocked_requests?: number | null
          created_at?: string | null
          csrf_violations?: number | null
          failed_login_attempts?: number | null
          id?: string
          metric_date?: string
          mfa_failures?: number | null
          rate_limit_violations?: number | null
          suspicious_api_calls?: number | null
          tenant_id?: string | null
          unique_attackers?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_metrics_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      settlement_transfers: {
        Row: {
          account_number: string | null
          amount: number
          bank_code: string | null
          bank_name: string | null
          beneficiary_name: string | null
          client_code: string | null
          completed_at: string | null
          created_at: string
          currency: string | null
          failed_reason: string | null
          id: number
          inserted_at: string
          merchant_code: string | null
          metadata: Json | null
          ops_type: string | null
          priority: string | null
          ref_id: string
          settlement_ref: string
          status: string
          sys_account_name: string | null
          sys_bank: string | null
          tx_id: string
          updated_at: string
        }
        Insert: {
          account_number?: string | null
          amount: number
          bank_code?: string | null
          bank_name?: string | null
          beneficiary_name?: string | null
          client_code?: string | null
          completed_at?: string | null
          created_at: string
          currency?: string | null
          failed_reason?: string | null
          id?: number
          inserted_at?: string
          merchant_code?: string | null
          metadata?: Json | null
          ops_type?: string | null
          priority?: string | null
          ref_id: string
          settlement_ref: string
          status: string
          sys_account_name?: string | null
          sys_bank?: string | null
          tx_id: string
          updated_at?: string
        }
        Update: {
          account_number?: string | null
          amount?: number
          bank_code?: string | null
          bank_name?: string | null
          beneficiary_name?: string | null
          client_code?: string | null
          completed_at?: string | null
          created_at?: string
          currency?: string | null
          failed_reason?: string | null
          id?: number
          inserted_at?: string
          merchant_code?: string | null
          metadata?: Json | null
          ops_type?: string | null
          priority?: string | null
          ref_id?: string
          settlement_ref?: string
          status?: string
          sys_account_name?: string | null
          sys_bank?: string | null
          tx_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      settlements: {
        Row: {
          created_at: string | null
          cycle: string
          fees: number
          id: string
          net_amount: number
          paid_out_at: string | null
          provider: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          cycle: string
          fees?: number
          id?: string
          net_amount: number
          paid_out_at?: string | null
          provider: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          cycle?: string
          fees?: number
          id?: string
          net_amount?: number
          paid_out_at?: string | null
          provider?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      shareholder_clients: {
        Row: {
          bounty_amount: number | null
          commission_rate: number
          commission_type: string | null
          created_at: string
          effective_from: string | null
          effective_to: string | null
          id: string
          notes: string | null
          referral_source: string | null
          referred_at: string
          shareholder_id: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          bounty_amount?: number | null
          commission_rate?: number
          commission_type?: string | null
          created_at?: string
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          notes?: string | null
          referral_source?: string | null
          referred_at?: string
          shareholder_id: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          bounty_amount?: number | null
          commission_rate?: number
          commission_type?: string | null
          created_at?: string
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          notes?: string | null
          referral_source?: string | null
          referred_at?: string
          shareholder_id?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shareholder_clients_shareholder_id_fkey"
            columns: ["shareholder_id"]
            isOneToOne: false
            referencedRelation: "shareholders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shareholder_clients_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      shareholder_earnings: {
        Row: {
          amount: number
          base_amount: number
          commission_rate: number
          created_at: string
          id: string
          payment_id: string | null
          period_end: string
          period_start: string
          shareholder_id: string
          status: string
          tenant_id: string
        }
        Insert: {
          amount: number
          base_amount: number
          commission_rate: number
          created_at?: string
          id?: string
          payment_id?: string | null
          period_end: string
          period_start: string
          shareholder_id: string
          status?: string
          tenant_id: string
        }
        Update: {
          amount?: number
          base_amount?: number
          commission_rate?: number
          created_at?: string
          id?: string
          payment_id?: string | null
          period_end?: string
          period_start?: string
          shareholder_id?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shareholder_earnings_shareholder_id_fkey"
            columns: ["shareholder_id"]
            isOneToOne: false
            referencedRelation: "shareholders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shareholder_earnings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      shareholder_invitations: {
        Row: {
          created_at: string
          created_by: string | null
          email: string
          expires_at: string
          id: string
          invalidated_at: string | null
          invalidation_reason: string | null
          last_resent_at: string | null
          magic_token: string
          resent_count: number
          shareholder_id: string
          temp_password_hash: string | null
          used_at: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email: string
          expires_at: string
          id?: string
          invalidated_at?: string | null
          invalidation_reason?: string | null
          last_resent_at?: string | null
          magic_token: string
          resent_count?: number
          shareholder_id: string
          temp_password_hash?: string | null
          used_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string
          expires_at?: string
          id?: string
          invalidated_at?: string | null
          invalidation_reason?: string | null
          last_resent_at?: string | null
          magic_token?: string
          resent_count?: number
          shareholder_id?: string
          temp_password_hash?: string | null
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shareholder_invitations_shareholder_id_fkey"
            columns: ["shareholder_id"]
            isOneToOne: false
            referencedRelation: "shareholders"
            referencedColumns: ["id"]
          },
        ]
      }
      shareholders: {
        Row: {
          active_clients_count: number
          adjust_max_percent: number | null
          adjust_min_percent: number | null
          allow_self_adjust: boolean | null
          balance: number
          created_at: string
          created_by: string | null
          default_commission_type: string | null
          default_commission_value: number | null
          email: string
          full_name: string
          id: string
          notes: string | null
          phone: string | null
          referral_code: string | null
          referral_count: number | null
          status: string
          total_commission_earned: number | null
          total_earnings: number
          updated_at: string
          user_id: string
        }
        Insert: {
          active_clients_count?: number
          adjust_max_percent?: number | null
          adjust_min_percent?: number | null
          allow_self_adjust?: boolean | null
          balance?: number
          created_at?: string
          created_by?: string | null
          default_commission_type?: string | null
          default_commission_value?: number | null
          email: string
          full_name: string
          id?: string
          notes?: string | null
          phone?: string | null
          referral_code?: string | null
          referral_count?: number | null
          status?: string
          total_commission_earned?: number | null
          total_earnings?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          active_clients_count?: number
          adjust_max_percent?: number | null
          adjust_min_percent?: number | null
          allow_self_adjust?: boolean | null
          balance?: number
          created_at?: string
          created_by?: string | null
          default_commission_type?: string | null
          default_commission_value?: number | null
          email?: string
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string | null
          referral_code?: string | null
          referral_count?: number | null
          status?: string
          total_commission_earned?: number | null
          total_earnings?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      temporary_codes: {
        Row: {
          claimed_at: string | null
          code: string
          created_at: string
          expires_at: string
          id: string
          is_active: boolean
          issued_by: string | null
          issued_from_context: string | null
          max_uses: number
          metadata: Json | null
          purpose: string
          tenant_id: string | null
          updated_at: string
          user_id: string
          uses_count: number
        }
        Insert: {
          claimed_at?: string | null
          code: string
          created_at?: string
          expires_at: string
          id?: string
          is_active?: boolean
          issued_by?: string | null
          issued_from_context?: string | null
          max_uses?: number
          metadata?: Json | null
          purpose: string
          tenant_id?: string | null
          updated_at?: string
          user_id: string
          uses_count?: number
        }
        Update: {
          claimed_at?: string | null
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          is_active?: boolean
          issued_by?: string | null
          issued_from_context?: string | null
          max_uses?: number
          metadata?: Json | null
          purpose?: string
          tenant_id?: string | null
          updated_at?: string
          user_id?: string
          uses_count?: number
        }
        Relationships: []
      }
      tenant_security_policy: {
        Row: {
          created_at: string | null
          require_2fa_for_admin: boolean | null
          require_2fa_for_developer: boolean | null
          require_2fa_for_finance: boolean | null
          require_2fa_for_manager: boolean | null
          require_2fa_for_owner: boolean | null
          stepup_window_seconds: number | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          require_2fa_for_admin?: boolean | null
          require_2fa_for_developer?: boolean | null
          require_2fa_for_finance?: boolean | null
          require_2fa_for_manager?: boolean | null
          require_2fa_for_owner?: boolean | null
          stepup_window_seconds?: number | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          require_2fa_for_admin?: boolean | null
          require_2fa_for_developer?: boolean | null
          require_2fa_for_finance?: boolean | null
          require_2fa_for_manager?: boolean | null
          require_2fa_for_owner?: boolean | null
          stepup_window_seconds?: number | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_security_policy_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_wallets: {
        Row: {
          balance: number
          created_at: string | null
          currency: string
          id: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          balance?: number
          created_at?: string | null
          currency?: string
          id?: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          balance?: number
          created_at?: string | null
          currency?: string
          id?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_wallets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          brand_logo_url: string | null
          brand_primary_color: string | null
          business_type: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string | null
          fee_plan: Json | null
          id: string
          kyc_level: number | null
          kyc_notes: string | null
          kyc_status: string | null
          kyc_verified_at: string | null
          kyc_verified_by: string | null
          name: string
          payout_bank_account: string | null
          payout_bank_name: string | null
          payout_schedule: string | null
          public_id: string
          referral_accepted_at: string | null
          referred_by_code: string | null
          referred_by_shareholder_id: string | null
          risk_rules: Json | null
          status: string
          tax_id: string | null
          user_id: string | null
        }
        Insert: {
          brand_logo_url?: string | null
          brand_primary_color?: string | null
          business_type?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          fee_plan?: Json | null
          id?: string
          kyc_level?: number | null
          kyc_notes?: string | null
          kyc_status?: string | null
          kyc_verified_at?: string | null
          kyc_verified_by?: string | null
          name: string
          payout_bank_account?: string | null
          payout_bank_name?: string | null
          payout_schedule?: string | null
          public_id: string
          referral_accepted_at?: string | null
          referred_by_code?: string | null
          referred_by_shareholder_id?: string | null
          risk_rules?: Json | null
          status?: string
          tax_id?: string | null
          user_id?: string | null
        }
        Update: {
          brand_logo_url?: string | null
          brand_primary_color?: string | null
          business_type?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          fee_plan?: Json | null
          id?: string
          kyc_level?: number | null
          kyc_notes?: string | null
          kyc_status?: string | null
          kyc_verified_at?: string | null
          kyc_verified_by?: string | null
          name?: string
          payout_bank_account?: string | null
          payout_bank_name?: string | null
          payout_schedule?: string | null
          public_id?: string
          referral_accepted_at?: string | null
          referred_by_code?: string | null
          referred_by_shareholder_id?: string | null
          risk_rules?: Json | null
          status?: string
          tax_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      topup_transfers: {
        Row: {
          account_name: string | null
          account_number: string | null
          amount: number
          bank_code: string | null
          bank_name: string | null
          client_code: string | null
          created_at: string
          currency: string | null
          id: number
          inserted_at: string
          merchant_code: string | null
          metadata: Json | null
          method: string | null
          ref_id: string
          status: string
          sys_account_name: string | null
          sys_account_number: string | null
          sys_bank: string | null
          topup_ref: string
          transfer_date: string | null
          updated_at: string
        }
        Insert: {
          account_name?: string | null
          account_number?: string | null
          amount: number
          bank_code?: string | null
          bank_name?: string | null
          client_code?: string | null
          created_at: string
          currency?: string | null
          id?: number
          inserted_at?: string
          merchant_code?: string | null
          metadata?: Json | null
          method?: string | null
          ref_id: string
          status: string
          sys_account_name?: string | null
          sys_account_number?: string | null
          sys_bank?: string | null
          topup_ref: string
          transfer_date?: string | null
          updated_at?: string
        }
        Update: {
          account_name?: string | null
          account_number?: string | null
          amount?: number
          bank_code?: string | null
          bank_name?: string | null
          client_code?: string | null
          created_at?: string
          currency?: string | null
          id?: number
          inserted_at?: string
          merchant_code?: string | null
          metadata?: Json | null
          method?: string | null
          ref_id?: string
          status?: string
          sys_account_name?: string | null
          sys_account_number?: string | null
          sys_bank?: string | null
          topup_ref?: string
          transfer_date?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      transaction_filters: {
        Row: {
          created_at: string
          filters: Json
          id: string
          is_default: boolean
          name: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filters?: Json
          id?: string
          is_default?: boolean
          name: string
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          filters?: Json
          id?: string
          is_default?: boolean
          name?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_filters_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          counterparty: string | null
          created_at: string
          created_by_id: string | null
          currency: string
          direction: Database["public"]["Enums"]["tx_direction"]
          fee: number
          id: string
          is_verified: boolean | null
          metadata: Json | null
          method: Database["public"]["Enums"]["tx_method"]
          net_amount: number
          note: string | null
          owner_tenant_id: string | null
          owner_user_id: string | null
          processed_at: string | null
          reference: string | null
          shareholder_id: string | null
          status: Database["public"]["Enums"]["tx_status"]
          tenant_id: string | null
          type: Database["public"]["Enums"]["tx_type"]
          verification_note: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          amount: number
          counterparty?: string | null
          created_at?: string
          created_by_id?: string | null
          currency?: string
          direction: Database["public"]["Enums"]["tx_direction"]
          fee?: number
          id?: string
          is_verified?: boolean | null
          metadata?: Json | null
          method: Database["public"]["Enums"]["tx_method"]
          net_amount: number
          note?: string | null
          owner_tenant_id?: string | null
          owner_user_id?: string | null
          processed_at?: string | null
          reference?: string | null
          shareholder_id?: string | null
          status?: Database["public"]["Enums"]["tx_status"]
          tenant_id?: string | null
          type: Database["public"]["Enums"]["tx_type"]
          verification_note?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          amount?: number
          counterparty?: string | null
          created_at?: string
          created_by_id?: string | null
          currency?: string
          direction?: Database["public"]["Enums"]["tx_direction"]
          fee?: number
          id?: string
          is_verified?: boolean | null
          metadata?: Json | null
          method?: Database["public"]["Enums"]["tx_method"]
          net_amount?: number
          note?: string | null
          owner_tenant_id?: string | null
          owner_user_id?: string | null
          processed_at?: string | null
          reference?: string | null
          shareholder_id?: string | null
          status?: Database["public"]["Enums"]["tx_status"]
          tenant_id?: string | null
          type?: Database["public"]["Enums"]["tx_type"]
          verification_note?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_shareholder_id_fkey"
            columns: ["shareholder_id"]
            isOneToOne: false
            referencedRelation: "shareholders"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          owner_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          owner_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          owner_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          attempts: number | null
          created_at: string | null
          delivered_at: string | null
          error_message: string | null
          event_type: string | null
          id: string
          last_error: string | null
          payload: Json | null
          provider: string | null
          response_body: string | null
          response_status: number | null
          retry_count: number
          status: string | null
          success: boolean | null
          tenant_id: string | null
          webhook_id: string
        }
        Insert: {
          attempts?: number | null
          created_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          event_type?: string | null
          id?: string
          last_error?: string | null
          payload?: Json | null
          provider?: string | null
          response_body?: string | null
          response_status?: number | null
          retry_count?: number
          status?: string | null
          success?: boolean | null
          tenant_id?: string | null
          webhook_id: string
        }
        Update: {
          attempts?: number | null
          created_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          event_type?: string | null
          id?: string
          last_error?: string | null
          payload?: Json | null
          provider?: string | null
          response_body?: string | null
          response_status?: number | null
          retry_count?: number
          status?: string | null
          success?: boolean | null
          tenant_id?: string | null
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_events_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      webhooks: {
        Row: {
          created_at: string
          description: string | null
          enabled: boolean
          events: Json | null
          failure_count: number
          id: string
          last_triggered_at: string | null
          secret: string
          success_count: number
          tenant_id: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          events?: Json | null
          failure_count?: number
          id?: string
          last_triggered_at?: string | null
          secret: string
          success_count?: number
          tenant_id: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          events?: Json | null
          failure_count?: number
          id?: string
          last_triggered_at?: string | null
          secret?: string
          success_count?: number
          tenant_id?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhooks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      withdraw_transfers: {
        Row: {
          afterwithdrawamt: number | null
          bankcode: string | null
          beforewithdrawamt: number | null
          cashtype: string | null
          created_at: string | null
          createdate: string | null
          custaccountnumber: string | null
          custphonenumber: string | null
          fullname: string | null
          id: number
          memberid: string | null
          note: string | null
          ref_id: string
          remark: string | null
          staff_activeid: string | null
          staff_activename: string | null
          status: string | null
          statusbanktranfer: boolean | null
          updated_at: string | null
          updatedate: string | null
          user_type: string | null
          username: string | null
          withdrawamt: number | null
          withdrawdate: string | null
          withdrawid: string | null
          withdrawkey: string | null
        }
        Insert: {
          afterwithdrawamt?: number | null
          bankcode?: string | null
          beforewithdrawamt?: number | null
          cashtype?: string | null
          created_at?: string | null
          createdate?: string | null
          custaccountnumber?: string | null
          custphonenumber?: string | null
          fullname?: string | null
          id?: number
          memberid?: string | null
          note?: string | null
          ref_id: string
          remark?: string | null
          staff_activeid?: string | null
          staff_activename?: string | null
          status?: string | null
          statusbanktranfer?: boolean | null
          updated_at?: string | null
          updatedate?: string | null
          user_type?: string | null
          username?: string | null
          withdrawamt?: number | null
          withdrawdate?: string | null
          withdrawid?: string | null
          withdrawkey?: string | null
        }
        Update: {
          afterwithdrawamt?: number | null
          bankcode?: string | null
          beforewithdrawamt?: number | null
          cashtype?: string | null
          created_at?: string | null
          createdate?: string | null
          custaccountnumber?: string | null
          custphonenumber?: string | null
          fullname?: string | null
          id?: number
          memberid?: string | null
          note?: string | null
          ref_id?: string
          remark?: string | null
          staff_activeid?: string | null
          staff_activename?: string | null
          status?: string | null
          statusbanktranfer?: boolean | null
          updated_at?: string | null
          updatedate?: string | null
          user_type?: string | null
          username?: string | null
          withdrawamt?: number | null
          withdrawdate?: string | null
          withdrawid?: string | null
          withdrawkey?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      v_tx_daily_by_shareholder: {
        Row: {
          deposit_net: number | null
          failed_count: number | null
          net_in: number | null
          net_out: number | null
          pending_count: number | null
          shareholder_id: string | null
          success_count: number | null
          transfer_net: number | null
          tx_count: number | null
          tx_date: string | null
          withdrawal_net: number | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_shareholder_id_fkey"
            columns: ["shareholder_id"]
            isOneToOne: false
            referencedRelation: "shareholders"
            referencedColumns: ["id"]
          },
        ]
      }
      v_tx_daily_by_tenant: {
        Row: {
          deposit_net: number | null
          failed_count: number | null
          net_in: number | null
          net_out: number | null
          pending_count: number | null
          success_count: number | null
          tenant_id: string | null
          transfer_net: number | null
          tx_count: number | null
          tx_date: string | null
          withdrawal_net: number | null
        }
        Relationships: []
      }
      v_tx_monthly_by_shareholder: {
        Row: {
          deposit_net: number | null
          net_in: number | null
          net_out: number | null
          shareholder_id: string | null
          success_count: number | null
          total_fees: number | null
          transfer_net: number | null
          tx_count: number | null
          tx_month: string | null
          withdrawal_net: number | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_shareholder_id_fkey"
            columns: ["shareholder_id"]
            isOneToOne: false
            referencedRelation: "shareholders"
            referencedColumns: ["id"]
          },
        ]
      }
      v_tx_monthly_by_tenant: {
        Row: {
          deposit_net: number | null
          net_in: number | null
          net_out: number | null
          success_count: number | null
          tenant_id: string | null
          total_fees: number | null
          transfer_net: number | null
          tx_count: number | null
          tx_month: string | null
          withdrawal_net: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      assign_owner_role_by_email: {
        Args: { _email: string }
        Returns: undefined
      }
      assign_super_admin_role_by_email: {
        Args: { _email: string }
        Returns: undefined
      }
      can_view_tenant_memberships: {
        Args: { _tenant_id: string; _uid: string }
        Returns: boolean
      }
      check_and_block_ip: {
        Args: {
          block_duration_minutes?: number
          check_ip: unknown
          threshold?: number
          violation_type: string
        }
        Returns: Json
      }
      cleanup_expired_codes: { Args: never; Returns: undefined }
      cleanup_replay_cache: { Args: never; Returns: undefined }
      decrypt_totp_secret: {
        Args: { encrypted_secret: string }
        Returns: string
      }
      enable_totp_with_codes: {
        Args: { backup_codes: string[]; user_id: string }
        Returns: undefined
      }
      encrypt_totp_secret: { Args: { secret_text: string }; Returns: string }
      generate_public_id: { Args: { prefix_code: string }; Returns: string }
      generate_referral_code: { Args: never; Returns: string }
      get_email_by_public_id: {
        Args: { input_public_id: string }
        Returns: string
      }
      get_shareholder_id: { Args: { user_uuid: string }; Returns: string }
      get_user_tenant_id: { Args: { user_uuid: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_ip_blocked: { Args: { check_ip: unknown }; Returns: boolean }
      is_member_of_tenant: { Args: { tenant_uuid: string }; Returns: boolean }
      is_shareholder: { Args: { user_uuid: string }; Returns: boolean }
      is_super_admin: { Args: { user_uuid: string }; Returns: boolean }
      is_valid_base64: { Args: { input: string }; Returns: boolean }
      request_tenant: { Args: never; Returns: string }
      update_totp_secret: {
        Args: { new_secret: string; user_id: string }
        Returns: undefined
      }
      user_has_role_in_tenant: {
        Args: { role_name: string; tenant_uuid: string; user_uuid: string }
        Returns: boolean
      }
      validate_api_key_access: {
        Args: { _endpoint: string; _ip: unknown; _prefix: string }
        Returns: Json
      }
      wallet_apply_delta: {
        Args: {
          p_amount: number
          p_currency: string
          p_direction: Database["public"]["Enums"]["tx_direction"]
          p_tenant_id: string
        }
        Returns: undefined
      }
      wallet_reverse_delta: {
        Args: {
          p_amount: number
          p_currency: string
          p_direction: Database["public"]["Enums"]["tx_direction"]
          p_tenant_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      api_key_type: "public" | "secret"
      app_role: "owner" | "admin" | "user" | "super_admin"
      kyc_document_type:
        | "national_id"
        | "passport"
        | "driving_license"
        | "business_registration"
        | "bank_statement"
        | "utility_bill"
        | "other"
      kyc_verification_status: "pending" | "approved" | "rejected"
      tx_direction: "IN" | "OUT"
      tx_method:
        | "BANK_TRANSFER"
        | "CARD"
        | "PROMPTPAY"
        | "CASH"
        | "WALLET"
        | "OTHER"
      tx_status: "PENDING" | "SUCCESS" | "FAILED" | "CANCELLED"
      tx_type:
        | "DEPOSIT"
        | "WITHDRAWAL"
        | "TRANSFER"
        | "REFUND"
        | "FEE"
        | "ADJUSTMENT"
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
      api_key_type: ["public", "secret"],
      app_role: ["owner", "admin", "user", "super_admin"],
      kyc_document_type: [
        "national_id",
        "passport",
        "driving_license",
        "business_registration",
        "bank_statement",
        "utility_bill",
        "other",
      ],
      kyc_verification_status: ["pending", "approved", "rejected"],
      tx_direction: ["IN", "OUT"],
      tx_method: [
        "BANK_TRANSFER",
        "CARD",
        "PROMPTPAY",
        "CASH",
        "WALLET",
        "OTHER",
      ],
      tx_status: ["PENDING", "SUCCESS", "FAILED", "CANCELLED"],
      tx_type: [
        "DEPOSIT",
        "WITHDRAWAL",
        "TRANSFER",
        "REFUND",
        "FEE",
        "ADJUSTMENT",
      ],
    },
  },
} as const
