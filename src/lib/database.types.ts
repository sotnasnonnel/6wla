export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      atividades_ppc: {
        Row: {
          atualizado_em: string;
          causa_6ms: string;
          conferido: boolean;
          criado_em: string;
          criado_por: string | null;
          desvio: string;
          disciplina: string;
          encarregado: string;
          id: string;
          id_atividade: string;
          inicio_semana: string;
          lider_imediato: string;
          nome_atividade: string;
          obra_id: string;
          observacoes: string;
          quantidade_prevista: number;
          quantidade_realizada: number | null;
          responsavel: string;
          semana: string;
          status_planejamento: string;
          termino_semana: string;
          unidade: string;
        };
        Insert: {
          atualizado_em?: string;
          causa_6ms?: string;
          conferido?: boolean;
          criado_em?: string;
          criado_por?: string | null;
          desvio?: string;
          disciplina?: string;
          encarregado?: string;
          id?: string;
          id_atividade: string;
          inicio_semana: string;
          lider_imediato?: string;
          nome_atividade: string;
          obra_id: string;
          observacoes?: string;
          quantidade_prevista: number;
          quantidade_realizada?: number | null;
          responsavel?: string;
          semana: string;
          status_planejamento?: string;
          termino_semana: string;
          unidade?: string;
        };
        Update: {
          atualizado_em?: string;
          causa_6ms?: string;
          conferido?: boolean;
          criado_em?: string;
          criado_por?: string | null;
          desvio?: string;
          disciplina?: string;
          encarregado?: string;
          id?: string;
          id_atividade?: string;
          inicio_semana?: string;
          lider_imediato?: string;
          nome_atividade?: string;
          obra_id?: string;
          observacoes?: string;
          quantidade_prevista?: number;
          quantidade_realizada?: number | null;
          responsavel?: string;
          semana?: string;
          status_planejamento?: string;
          termino_semana?: string;
          unidade?: string;
        };
        Relationships: [
          {
            foreignKeyName: "atividades_ppc_criado_por_fkey";
            columns: ["criado_por"];
            isOneToOne: false;
            referencedRelation: "perfis";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "atividades_ppc_obra_id_fkey";
            columns: ["obra_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      importacoes: {
        Row: {
          aba: string;
          arquivo_nome: string;
          atualizadas: number;
          cabecalhos: string[];
          concluido_em: string | null;
          criado_em: string;
          criado_por: string | null;
          id: string;
          ignoradas: number;
          importadas: number;
          linhas: Json;
          mapa_colunas: Json;
          mapa_origem: string;
          modo: Database["public"]["Enums"]["importacao_modo"];
          obra_id: string;
          status: Database["public"]["Enums"]["importacao_status"];
          total_linhas: number;
        };
        Insert: {
          aba: string;
          arquivo_nome: string;
          atualizadas?: number;
          cabecalhos?: string[];
          concluido_em?: string | null;
          criado_em?: string;
          criado_por?: string | null;
          id?: string;
          ignoradas?: number;
          importadas?: number;
          linhas?: Json;
          mapa_colunas?: Json;
          mapa_origem?: string;
          modo?: Database["public"]["Enums"]["importacao_modo"];
          obra_id: string;
          status?: Database["public"]["Enums"]["importacao_status"];
          total_linhas?: number;
        };
        Update: {
          aba?: string;
          arquivo_nome?: string;
          atualizadas?: number;
          cabecalhos?: string[];
          concluido_em?: string | null;
          criado_em?: string;
          criado_por?: string | null;
          id?: string;
          ignoradas?: number;
          importadas?: number;
          linhas?: Json;
          mapa_colunas?: Json;
          mapa_origem?: string;
          modo?: Database["public"]["Enums"]["importacao_modo"];
          obra_id?: string;
          status?: Database["public"]["Enums"]["importacao_status"];
          total_linhas?: number;
        };
        Relationships: [
          {
            foreignKeyName: "importacoes_criado_por_fkey";
            columns: ["criado_por"];
            isOneToOne: false;
            referencedRelation: "perfis";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "importacoes_obra_id_fkey";
            columns: ["obra_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      membros_workspace: {
        Row: {
          criado_em: string;
          papel: Database["public"]["Enums"]["workspace_papel"];
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          criado_em?: string;
          papel?: Database["public"]["Enums"]["workspace_papel"];
          user_id: string;
          workspace_id: string;
        };
        Update: {
          criado_em?: string;
          papel?: Database["public"]["Enums"]["workspace_papel"];
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "membros_workspace_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "perfis";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "membros_workspace_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      notificacoes: {
        Row: {
          autor_id: string | null;
          comentario_id: string | null;
          criado_em: string;
          id: string;
          lida_em: string | null;
          restricao_id: string;
          tipo: Database["public"]["Enums"]["notificacao_tipo"];
          user_id: string;
        };
        Insert: {
          autor_id?: string | null;
          comentario_id?: string | null;
          criado_em?: string;
          id?: string;
          lida_em?: string | null;
          restricao_id: string;
          tipo: Database["public"]["Enums"]["notificacao_tipo"];
          user_id: string;
        };
        Update: {
          autor_id?: string | null;
          comentario_id?: string | null;
          criado_em?: string;
          id?: string;
          lida_em?: string | null;
          restricao_id?: string;
          tipo?: Database["public"]["Enums"]["notificacao_tipo"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notificacoes_autor_id_fkey";
            columns: ["autor_id"];
            isOneToOne: false;
            referencedRelation: "perfis";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notificacoes_comentario_id_fkey";
            columns: ["comentario_id"];
            isOneToOne: false;
            referencedRelation: "restricao_comentarios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notificacoes_restricao_id_fkey";
            columns: ["restricao_id"];
            isOneToOne: false;
            referencedRelation: "restricoes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notificacoes_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "perfis";
            referencedColumns: ["id"];
          },
        ];
      };
      obras: {
        Row: {
          ativa: boolean;
          codigo: string;
          criado_em: string;
          id: string;
          nome: string;
          workspace_id: string;
        };
        Insert: {
          ativa?: boolean;
          codigo: string;
          criado_em?: string;
          id?: string;
          nome: string;
          workspace_id: string;
        };
        Update: {
          ativa?: boolean;
          codigo?: string;
          criado_em?: string;
          id?: string;
          nome?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "obras_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      perfis: {
        Row: {
          admin: boolean;
          ativo: boolean;
          criado_em: string;
          email: string;
          id: string;
          nome: string;
        };
        Insert: {
          admin?: boolean;
          ativo?: boolean;
          criado_em?: string;
          email: string;
          id: string;
          nome: string;
        };
        Update: {
          admin?: boolean;
          ativo?: boolean;
          criado_em?: string;
          email?: string;
          id?: string;
          nome?: string;
        };
        Relationships: [];
      };
      restricao_anexos: {
        Row: {
          caminho: string;
          criado_em: string;
          criado_por: string | null;
          id: string;
          nome: string;
          restricao_id: string;
          tamanho: number;
          tipo_mime: string | null;
        };
        Insert: {
          caminho: string;
          criado_em?: string;
          criado_por?: string | null;
          id?: string;
          nome: string;
          restricao_id: string;
          tamanho: number;
          tipo_mime?: string | null;
        };
        Update: {
          caminho?: string;
          criado_em?: string;
          criado_por?: string | null;
          id?: string;
          nome?: string;
          restricao_id?: string;
          tamanho?: number;
          tipo_mime?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "restricao_anexos_criado_por_fkey";
            columns: ["criado_por"];
            isOneToOne: false;
            referencedRelation: "perfis";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "restricao_anexos_restricao_id_fkey";
            columns: ["restricao_id"];
            isOneToOne: false;
            referencedRelation: "restricoes";
            referencedColumns: ["id"];
          },
        ];
      };
      restricao_comentarios: {
        Row: {
          autor_id: string | null;
          criado_em: string;
          id: string;
          mencoes: string[];
          restricao_id: string;
          texto: string;
        };
        Insert: {
          autor_id?: string | null;
          criado_em?: string;
          id?: string;
          mencoes?: string[];
          restricao_id: string;
          texto: string;
        };
        Update: {
          autor_id?: string | null;
          criado_em?: string;
          id?: string;
          mencoes?: string[];
          restricao_id?: string;
          texto?: string;
        };
        Relationships: [
          {
            foreignKeyName: "restricao_comentarios_autor_id_fkey";
            columns: ["autor_id"];
            isOneToOne: false;
            referencedRelation: "perfis";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "restricao_comentarios_restricao_id_fkey";
            columns: ["restricao_id"];
            isOneToOne: false;
            referencedRelation: "restricoes";
            referencedColumns: ["id"];
          },
        ];
      };
      restricao_eventos: {
        Row: {
          autor_id: string | null;
          campo: string | null;
          criado_em: string;
          id: string;
          restricao_id: string;
          tipo: Database["public"]["Enums"]["evento_tipo"];
          valor_anterior: string | null;
          valor_novo: string | null;
        };
        Insert: {
          autor_id?: string | null;
          campo?: string | null;
          criado_em?: string;
          id?: string;
          restricao_id: string;
          tipo: Database["public"]["Enums"]["evento_tipo"];
          valor_anterior?: string | null;
          valor_novo?: string | null;
        };
        Update: {
          autor_id?: string | null;
          campo?: string | null;
          criado_em?: string;
          id?: string;
          restricao_id?: string;
          tipo?: Database["public"]["Enums"]["evento_tipo"];
          valor_anterior?: string | null;
          valor_novo?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "restricao_eventos_autor_id_fkey";
            columns: ["autor_id"];
            isOneToOne: false;
            referencedRelation: "perfis";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "restricao_eventos_restricao_id_fkey";
            columns: ["restricao_id"];
            isOneToOne: false;
            referencedRelation: "restricoes";
            referencedColumns: ["id"];
          },
        ];
      };
      restricoes: {
        Row: {
          acao: string | null;
          area: string | null;
          atividade_impactada: string | null;
          atualizado_em: string;
          causa_6m: string | null;
          classificacao: string | null;
          codigo: string | null;
          criado_em: string;
          criado_por: string | null;
          data_conclusao: string | null;
          data_criacao: string;
          data_limite: string | null;
          descricao: string;
          descricao_status: string | null;
          extras: Json;
          id: string;
          id_atividade: string | null;
          importacao_id: string | null;
          inicio_atividade: string | null;
          localizacao: string | null;
          numero: number;
          obra_id: string;
          observacoes: string | null;
          origem: Database["public"]["Enums"]["restricao_origem"];
          prazo_original: string | null;
          previsao_conclusao: string | null;
          prioridade: Database["public"]["Enums"]["restricao_prioridade"];
          reprogramacoes: number;
          responsavel_email: string | null;
          responsavel_id: string | null;
          responsavel_nome: string | null;
          responsavel_telefone: string | null;
          semana_programada: string | null;
          setor: string | null;
          status: Database["public"]["Enums"]["restricao_status"];
        };
        Insert: {
          acao?: string | null;
          area?: string | null;
          atividade_impactada?: string | null;
          atualizado_em?: string;
          causa_6m?: string | null;
          classificacao?: string | null;
          codigo?: string | null;
          criado_em?: string;
          criado_por?: string | null;
          data_conclusao?: string | null;
          data_criacao?: string;
          data_limite?: string | null;
          descricao: string;
          descricao_status?: string | null;
          extras?: Json;
          id?: string;
          id_atividade?: string | null;
          importacao_id?: string | null;
          inicio_atividade?: string | null;
          localizacao?: string | null;
          numero?: number;
          obra_id: string;
          observacoes?: string | null;
          origem?: Database["public"]["Enums"]["restricao_origem"];
          prazo_original?: string | null;
          previsao_conclusao?: string | null;
          prioridade?: Database["public"]["Enums"]["restricao_prioridade"];
          reprogramacoes?: number;
          responsavel_email?: string | null;
          responsavel_id?: string | null;
          responsavel_nome?: string | null;
          responsavel_telefone?: string | null;
          semana_programada?: string | null;
          setor?: string | null;
          status?: Database["public"]["Enums"]["restricao_status"];
        };
        Update: {
          acao?: string | null;
          area?: string | null;
          atividade_impactada?: string | null;
          atualizado_em?: string;
          causa_6m?: string | null;
          classificacao?: string | null;
          codigo?: string | null;
          criado_em?: string;
          criado_por?: string | null;
          data_conclusao?: string | null;
          data_criacao?: string;
          data_limite?: string | null;
          descricao?: string;
          descricao_status?: string | null;
          extras?: Json;
          id?: string;
          id_atividade?: string | null;
          importacao_id?: string | null;
          inicio_atividade?: string | null;
          localizacao?: string | null;
          numero?: number;
          obra_id?: string;
          observacoes?: string | null;
          origem?: Database["public"]["Enums"]["restricao_origem"];
          prazo_original?: string | null;
          previsao_conclusao?: string | null;
          prioridade?: Database["public"]["Enums"]["restricao_prioridade"];
          reprogramacoes?: number;
          responsavel_email?: string | null;
          responsavel_id?: string | null;
          responsavel_nome?: string | null;
          responsavel_telefone?: string | null;
          semana_programada?: string | null;
          setor?: string | null;
          status?: Database["public"]["Enums"]["restricao_status"];
        };
        Relationships: [
          {
            foreignKeyName: "restricoes_criado_por_fkey";
            columns: ["criado_por"];
            isOneToOne: false;
            referencedRelation: "perfis";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "restricoes_importacao_id_fkey";
            columns: ["importacao_id"];
            isOneToOne: false;
            referencedRelation: "importacoes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "restricoes_obra_id_fkey";
            columns: ["obra_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "restricoes_responsavel_id_fkey";
            columns: ["responsavel_id"];
            isOneToOne: false;
            referencedRelation: "perfis";
            referencedColumns: ["id"];
          },
        ];
      };
      workspaces: {
        Row: {
          ativo: boolean;
          codigo: string;
          criado_em: string;
          id: string;
          nome: string;
        };
        Insert: {
          ativo?: boolean;
          codigo: string;
          criado_em?: string;
          id?: string;
          nome: string;
        };
        Update: {
          ativo?: boolean;
          codigo?: string;
          criado_em?: string;
          id?: string;
          nome?: string;
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
      evento_tipo: "criada" | "alteracao" | "importada";
      importacao_modo: "adicionar" | "atualizar";
      importacao_status: "rascunho" | "concluida" | "cancelada";
      notificacao_tipo: "mencao" | "atribuicao" | "comentario";
      restricao_origem: "manual" | "importada";
      restricao_prioridade: "urgente" | "alta" | "media" | "baixa";
      restricao_status: "pendente" | "em_andamento" | "concluida" | "cancelada";
      workspace_papel: "admin" | "gestor" | "membro";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      evento_tipo: ["criada", "alteracao", "importada"],
      importacao_modo: ["adicionar", "atualizar"],
      importacao_status: ["rascunho", "concluida", "cancelada"],
      notificacao_tipo: ["mencao", "atribuicao", "comentario"],
      restricao_origem: ["manual", "importada"],
      restricao_prioridade: ["urgente", "alta", "media", "baixa"],
      restricao_status: ["pendente", "em_andamento", "concluida", "cancelada"],
      workspace_papel: ["admin", "gestor", "membro"],
    },
  },
} as const;
