export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      disparo_itens: {
        Row: {
          disparo_id: string
          restricao_id: string
        }
        Insert: {
          disparo_id: string
          restricao_id: string
        }
        Update: {
          disparo_id?: string
          restricao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "disparo_itens_disparo_id_fkey"
            columns: ["disparo_id"]
            isOneToOne: false
            referencedRelation: "disparos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disparo_itens_restricao_id_fkey"
            columns: ["restricao_id"]
            isOneToOne: false
            referencedRelation: "restricoes"
            referencedColumns: ["id"]
          },
        ]
      }
      disparos: {
        Row: {
          canal: Database["public"]["Enums"]["disparo_canal"]
          destinatario_email: string
          enviado_em: string
          erro: string | null
          id: string
          obra_id: string
          qtd_restricoes: number
          sucesso: boolean
        }
        Insert: {
          canal?: Database["public"]["Enums"]["disparo_canal"]
          destinatario_email: string
          enviado_em?: string
          erro?: string | null
          id?: string
          obra_id: string
          qtd_restricoes?: number
          sucesso: boolean
        }
        Update: {
          canal?: Database["public"]["Enums"]["disparo_canal"]
          destinatario_email?: string
          enviado_em?: string
          erro?: string | null
          id?: string
          obra_id?: string
          qtd_restricoes?: number
          sucesso?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "disparos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      membros_obra: {
        Row: {
          criado_em: string
          obra_id: string
          papel: Database["public"]["Enums"]["papel_obra"]
          user_id: string
        }
        Insert: {
          criado_em?: string
          obra_id: string
          papel: Database["public"]["Enums"]["papel_obra"]
          user_id: string
        }
        Update: {
          criado_em?: string
          obra_id?: string
          papel?: Database["public"]["Enums"]["papel_obra"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "membros_obra_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membros_obra_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_fontes: {
        Row: {
          aba: string
          arquivo_url: string
          copias_fixas: string[]
          criado_em: string
          dias_disparo: number[]
          hora_disparo: string
          linhas_descartadas: number
          mapa_colunas: Json
          mapa_status: Json
          obra_id: string
          sincronia_ativa: boolean
          ultima_escrita_em: string | null
          ultima_leitura_em: string | null
        }
        Insert: {
          aba?: string
          arquivo_url: string
          copias_fixas?: string[]
          criado_em?: string
          dias_disparo?: number[]
          hora_disparo?: string
          linhas_descartadas?: number
          mapa_colunas?: Json
          mapa_status?: Json
          obra_id: string
          sincronia_ativa?: boolean
          ultima_escrita_em?: string | null
          ultima_leitura_em?: string | null
        }
        Update: {
          aba?: string
          arquivo_url?: string
          copias_fixas?: string[]
          criado_em?: string
          dias_disparo?: number[]
          hora_disparo?: string
          linhas_descartadas?: number
          mapa_colunas?: Json
          mapa_status?: Json
          obra_id?: string
          sincronia_ativa?: boolean
          ultima_escrita_em?: string | null
          ultima_leitura_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "obra_fontes_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: true
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      obras: {
        Row: {
          ativa: boolean
          codigo: string
          criado_em: string
          id: string
          nome: string
        }
        Insert: {
          ativa?: boolean
          codigo: string
          criado_em?: string
          id?: string
          nome: string
        }
        Update: {
          ativa?: boolean
          codigo?: string
          criado_em?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      perfis: {
        Row: {
          criado_em: string
          email: string
          id: string
          nome: string | null
          pmo: boolean
        }
        Insert: {
          criado_em?: string
          email: string
          id: string
          nome?: string | null
          pmo?: boolean
        }
        Update: {
          criado_em?: string
          email?: string
          id?: string
          nome?: string | null
          pmo?: boolean
        }
        Relationships: []
      }
      restricao_eventos: {
        Row: {
          autor_email: string | null
          autor_id: string | null
          comentario: string | null
          criado_em: string
          id: string
          restricao_id: string
          status_anterior:
            | Database["public"]["Enums"]["restricao_status"]
            | null
          status_novo: Database["public"]["Enums"]["restricao_status"] | null
          tipo: Database["public"]["Enums"]["evento_tipo"]
        }
        Insert: {
          autor_email?: string | null
          autor_id?: string | null
          comentario?: string | null
          criado_em?: string
          id?: string
          restricao_id: string
          status_anterior?:
            | Database["public"]["Enums"]["restricao_status"]
            | null
          status_novo?: Database["public"]["Enums"]["restricao_status"] | null
          tipo: Database["public"]["Enums"]["evento_tipo"]
        }
        Update: {
          autor_email?: string | null
          autor_id?: string | null
          comentario?: string | null
          criado_em?: string
          id?: string
          restricao_id?: string
          status_anterior?:
            | Database["public"]["Enums"]["restricao_status"]
            | null
          status_novo?: Database["public"]["Enums"]["restricao_status"] | null
          tipo?: Database["public"]["Enums"]["evento_tipo"]
        }
        Relationships: [
          {
            foreignKeyName: "restricao_eventos_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restricao_eventos_restricao_id_fkey"
            columns: ["restricao_id"]
            isOneToOne: false
            referencedRelation: "restricoes"
            referencedColumns: ["id"]
          },
        ]
      }
      restricoes: {
        Row: {
          acao: string | null
          atividade_impactada: string | null
          classificacao: string | null
          criado_em: string
          data_criacao: string | null
          data_limite: string | null
          descricao: string
          extras: Json
          id: string
          linha_planilha: number | null
          localizacao: string | null
          obra_id: string
          removida_da_planilha: boolean
          responsavel_email: string | null
          responsavel_nome: string | null
          setor: string | null
          sincronizado_em: string
          status: Database["public"]["Enums"]["restricao_status"]
          status_alterado_em: string
          status_alterado_por: string | null
          status_escrito_em: string | null
        }
        Insert: {
          acao?: string | null
          atividade_impactada?: string | null
          classificacao?: string | null
          criado_em?: string
          data_criacao?: string | null
          data_limite?: string | null
          descricao: string
          extras?: Json
          id?: string
          linha_planilha?: number | null
          localizacao?: string | null
          obra_id: string
          removida_da_planilha?: boolean
          responsavel_email?: string | null
          responsavel_nome?: string | null
          setor?: string | null
          sincronizado_em?: string
          status?: Database["public"]["Enums"]["restricao_status"]
          status_alterado_em?: string
          status_alterado_por?: string | null
          status_escrito_em?: string | null
        }
        Update: {
          acao?: string | null
          atividade_impactada?: string | null
          classificacao?: string | null
          criado_em?: string
          data_criacao?: string | null
          data_limite?: string | null
          descricao?: string
          extras?: Json
          id?: string
          linha_planilha?: number | null
          localizacao?: string | null
          obra_id?: string
          removida_da_planilha?: boolean
          responsavel_email?: string | null
          responsavel_nome?: string | null
          setor?: string | null
          sincronizado_em?: string
          status?: Database["public"]["Enums"]["restricao_status"]
          status_alterado_em?: string
          status_alterado_por?: string | null
          status_escrito_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restricoes_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restricoes_status_alterado_por_fkey"
            columns: ["status_alterado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      restricao_atrasada: {
        Args: { r: Database["public"]["Tables"]["restricoes"]["Row"] }
        Returns: boolean
      }
    }
    Enums: {
      disparo_canal: "email" | "whatsapp"
      evento_tipo: "criada" | "status" | "comentario" | "sincronizacao"
      papel_obra: "responsavel" | "gestor"
      restricao_status: "pendente" | "em_tratativa" | "resolvida" | "cancelada"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      disparo_canal: ["email", "whatsapp"],
      evento_tipo: ["criada", "status", "comentario", "sincronizacao"],
      papel_obra: ["responsavel", "gestor"],
      restricao_status: ["pendente", "em_tratativa", "resolvida", "cancelada"],
    },
  },
} as const

