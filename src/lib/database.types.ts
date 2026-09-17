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
      "6wla_automacao_fluxos": {
        Row: {
          ativo: boolean
          erro: string | null
          n8n_id: string | null
          nome: string
          obra_id: string
          sincronizado_em: string
        }
        Insert: {
          ativo?: boolean
          erro?: string | null
          n8n_id?: string | null
          nome: string
          obra_id: string
          sincronizado_em?: string
        }
        Update: {
          ativo?: boolean
          erro?: string | null
          n8n_id?: string | null
          nome?: string
          obra_id?: string
          sincronizado_em?: string
        }
        Relationships: [
          {
            foreignKeyName: "6wla_automacao_fluxos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: true
            referencedRelation: "6wla_obras"
            referencedColumns: ["id"]
          },
        ]
      }
      "6wla_automacao_envios": {
        Row: {
          agendado_para: string
          assunto: string
          automacao_id: string
          confirmado_em: string | null
          copias: string[]
          criado_em: string
          destinatario: string
          entregue_em: string | null
          erro: string | null
          id: string
          status: string
          teste: boolean
          total_itens: number
        }
        Insert: {
          agendado_para: string
          assunto?: string
          automacao_id: string
          confirmado_em?: string | null
          copias?: string[]
          criado_em?: string
          destinatario: string
          entregue_em?: string | null
          erro?: string | null
          id?: string
          status?: string
          teste?: boolean
          total_itens?: number
        }
        Update: {
          agendado_para?: string
          assunto?: string
          automacao_id?: string
          confirmado_em?: string | null
          copias?: string[]
          criado_em?: string
          destinatario?: string
          entregue_em?: string | null
          erro?: string | null
          id?: string
          status?: string
          teste?: boolean
          total_itens?: number
        }
        Relationships: [
          {
            foreignKeyName: "6wla_automacao_envios_automacao_id_fkey"
            columns: ["automacao_id"]
            isOneToOne: false
            referencedRelation: "6wla_automacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      "6wla_automacoes": {
        Row: {
          agrupar_por_responsavel: boolean
          assunto: string
          ativa: boolean
          atualizado_em: string
          colunas: string[]
          copias: string[]
          criado_em: string
          criado_por: string | null
          destinatarios: string[]
          destino: string
          dias_semana: number[]
          fuso: string
          hora: string
          id: string
          nome: string
          obra_id: string
          situacoes: string[]
          ultimo_disparo: string | null
        }
        Insert: {
          agrupar_por_responsavel?: boolean
          assunto: string
          ativa?: boolean
          atualizado_em?: string
          colunas: string[]
          copias?: string[]
          criado_em?: string
          criado_por?: string | null
          destinatarios?: string[]
          destino: string
          dias_semana: number[]
          fuso?: string
          hora: string
          id?: string
          nome: string
          obra_id: string
          situacoes: string[]
          ultimo_disparo?: string | null
        }
        Update: {
          agrupar_por_responsavel?: boolean
          assunto?: string
          ativa?: boolean
          atualizado_em?: string
          colunas?: string[]
          copias?: string[]
          criado_em?: string
          criado_por?: string | null
          destinatarios?: string[]
          destino?: string
          dias_semana?: number[]
          fuso?: string
          hora?: string
          id?: string
          nome?: string
          obra_id?: string
          situacoes?: string[]
          ultimo_disparo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "6wla_automacoes_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "6wla_perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "6wla_automacoes_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "6wla_obras"
            referencedColumns: ["id"]
          },
        ]
      }
      "6wla_importacoes": {
        Row: {
          aba: string
          arquivo_nome: string
          atualizadas: number
          cabecalhos: string[]
          concluido_em: string | null
          criado_em: string
          criado_por: string | null
          id: string
          ignoradas: number
          importadas: number
          linhas: Json
          mapa_colunas: Json
          mapa_origem: string
          modo: Database["public"]["Enums"]["6wla_importacao_modo"]
          obra_id: string
          relatorio: Json
          status: Database["public"]["Enums"]["6wla_importacao_status"]
          total_linhas: number
        }
        Insert: {
          aba: string
          arquivo_nome: string
          atualizadas?: number
          cabecalhos?: string[]
          concluido_em?: string | null
          criado_em?: string
          criado_por?: string | null
          id?: string
          ignoradas?: number
          importadas?: number
          linhas?: Json
          mapa_colunas?: Json
          mapa_origem?: string
          modo?: Database["public"]["Enums"]["6wla_importacao_modo"]
          obra_id: string
          relatorio?: Json
          status?: Database["public"]["Enums"]["6wla_importacao_status"]
          total_linhas?: number
        }
        Update: {
          aba?: string
          arquivo_nome?: string
          atualizadas?: number
          cabecalhos?: string[]
          concluido_em?: string | null
          criado_em?: string
          criado_por?: string | null
          id?: string
          ignoradas?: number
          importadas?: number
          linhas?: Json
          mapa_colunas?: Json
          mapa_origem?: string
          modo?: Database["public"]["Enums"]["6wla_importacao_modo"]
          obra_id?: string
          relatorio?: Json
          status?: Database["public"]["Enums"]["6wla_importacao_status"]
          total_linhas?: number
        }
        Relationships: [
          {
            foreignKeyName: "6wla_importacoes_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "6wla_perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "6wla_importacoes_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "6wla_obras"
            referencedColumns: ["id"]
          },
        ]
      }
      "6wla_membros_obra": {
        Row: {
          adicionado_por: string | null
          criado_em: string
          obra_id: string
          user_id: string
        }
        Insert: {
          adicionado_por?: string | null
          criado_em?: string
          obra_id: string
          user_id: string
        }
        Update: {
          adicionado_por?: string | null
          criado_em?: string
          obra_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "6wla_membros_obra_adicionado_por_fkey"
            columns: ["adicionado_por"]
            isOneToOne: false
            referencedRelation: "6wla_perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "6wla_membros_obra_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "6wla_obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "6wla_membros_obra_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "6wla_perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      "6wla_membros_workspace": {
        Row: {
          criado_em: string
          papel: Database["public"]["Enums"]["6wla_workspace_papel"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          criado_em?: string
          papel?: Database["public"]["Enums"]["6wla_workspace_papel"]
          user_id: string
          workspace_id: string
        }
        Update: {
          criado_em?: string
          papel?: Database["public"]["Enums"]["6wla_workspace_papel"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "6wla_membros_workspace_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "6wla_perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "6wla_membros_workspace_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "6wla_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      "6wla_notificacoes": {
        Row: {
          autor_id: string | null
          comentario_id: string | null
          criado_em: string
          id: string
          lida_em: string | null
          restricao_id: string
          tipo: Database["public"]["Enums"]["6wla_notificacao_tipo"]
          user_id: string
        }
        Insert: {
          autor_id?: string | null
          comentario_id?: string | null
          criado_em?: string
          id?: string
          lida_em?: string | null
          restricao_id: string
          tipo: Database["public"]["Enums"]["6wla_notificacao_tipo"]
          user_id: string
        }
        Update: {
          autor_id?: string | null
          comentario_id?: string | null
          criado_em?: string
          id?: string
          lida_em?: string | null
          restricao_id?: string
          tipo?: Database["public"]["Enums"]["6wla_notificacao_tipo"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "6wla_notificacoes_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "6wla_perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "6wla_notificacoes_comentario_id_fkey"
            columns: ["comentario_id"]
            isOneToOne: false
            referencedRelation: "6wla_restricao_comentarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "6wla_notificacoes_restricao_id_fkey"
            columns: ["restricao_id"]
            isOneToOne: false
            referencedRelation: "6wla_restricoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "6wla_notificacoes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "6wla_perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      "6wla_obras": {
        Row: {
          ativa: boolean
          codigo: string
          criado_em: string
          criado_por: string | null
          id: string
          nome: string
          workspace_id: string
        }
        Insert: {
          ativa?: boolean
          codigo: string
          criado_em?: string
          criado_por?: string | null
          id?: string
          nome: string
          workspace_id: string
        }
        Update: {
          ativa?: boolean
          codigo?: string
          criado_em?: string
          criado_por?: string | null
          id?: string
          nome?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "6wla_obras_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "6wla_perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "6wla_obras_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "6wla_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      "6wla_perfis": {
        Row: {
          admin: boolean
          ativo: boolean
          criado_em: string
          email: string
          id: string
          nome: string
        }
        Insert: {
          admin?: boolean
          ativo?: boolean
          criado_em?: string
          email: string
          id: string
          nome: string
        }
        Update: {
          admin?: boolean
          ativo?: boolean
          criado_em?: string
          email?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      "6wla_restricao_anexos": {
        Row: {
          caminho: string
          criado_em: string
          criado_por: string | null
          id: string
          nome: string
          restricao_id: string
          tamanho: number
          tipo_mime: string | null
        }
        Insert: {
          caminho: string
          criado_em?: string
          criado_por?: string | null
          id?: string
          nome: string
          restricao_id: string
          tamanho: number
          tipo_mime?: string | null
        }
        Update: {
          caminho?: string
          criado_em?: string
          criado_por?: string | null
          id?: string
          nome?: string
          restricao_id?: string
          tamanho?: number
          tipo_mime?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "6wla_restricao_anexos_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "6wla_perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "6wla_restricao_anexos_restricao_id_fkey"
            columns: ["restricao_id"]
            isOneToOne: false
            referencedRelation: "6wla_restricoes"
            referencedColumns: ["id"]
          },
        ]
      }
      "6wla_restricao_comentarios": {
        Row: {
          autor_id: string | null
          criado_em: string
          id: string
          mencoes: string[]
          restricao_id: string
          texto: string
        }
        Insert: {
          autor_id?: string | null
          criado_em?: string
          id?: string
          mencoes?: string[]
          restricao_id: string
          texto: string
        }
        Update: {
          autor_id?: string | null
          criado_em?: string
          id?: string
          mencoes?: string[]
          restricao_id?: string
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "6wla_restricao_comentarios_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "6wla_perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "6wla_restricao_comentarios_restricao_id_fkey"
            columns: ["restricao_id"]
            isOneToOne: false
            referencedRelation: "6wla_restricoes"
            referencedColumns: ["id"]
          },
        ]
      }
      "6wla_restricao_eventos": {
        Row: {
          autor_id: string | null
          campo: string | null
          criado_em: string
          id: string
          restricao_id: string
          tipo: Database["public"]["Enums"]["6wla_evento_tipo"]
          valor_anterior: string | null
          valor_novo: string | null
        }
        Insert: {
          autor_id?: string | null
          campo?: string | null
          criado_em?: string
          id?: string
          restricao_id: string
          tipo: Database["public"]["Enums"]["6wla_evento_tipo"]
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Update: {
          autor_id?: string | null
          campo?: string | null
          criado_em?: string
          id?: string
          restricao_id?: string
          tipo?: Database["public"]["Enums"]["6wla_evento_tipo"]
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "6wla_restricao_eventos_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "6wla_perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "6wla_restricao_eventos_restricao_id_fkey"
            columns: ["restricao_id"]
            isOneToOne: false
            referencedRelation: "6wla_restricoes"
            referencedColumns: ["id"]
          },
        ]
      }
      "6wla_restricao_tarefas": {
        Row: {
          concluida: boolean
          concluida_em: string | null
          concluida_por: string | null
          criado_em: string
          criado_por: string | null
          id: string
          restricao_id: string
          texto: string
        }
        Insert: {
          concluida?: boolean
          concluida_em?: string | null
          concluida_por?: string | null
          criado_em?: string
          criado_por?: string | null
          id?: string
          restricao_id: string
          texto: string
        }
        Update: {
          concluida?: boolean
          concluida_em?: string | null
          concluida_por?: string | null
          criado_em?: string
          criado_por?: string | null
          id?: string
          restricao_id?: string
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "6wla_restricao_tarefas_concluida_por_fkey"
            columns: ["concluida_por"]
            isOneToOne: false
            referencedRelation: "6wla_perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "6wla_restricao_tarefas_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "6wla_perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "6wla_restricao_tarefas_restricao_id_fkey"
            columns: ["restricao_id"]
            isOneToOne: false
            referencedRelation: "6wla_restricoes"
            referencedColumns: ["id"]
          },
        ]
      }
      "6wla_restricoes": {
        Row: {
          acao: string | null
          area: string | null
          atividade_impactada: string | null
          atualizado_em: string
          causa_6m: string | null
          classificacao: string | null
          codigo: string | null
          criado_em: string
          criado_por: string | null
          data_conclusao: string | null
          data_criacao: string
          data_limite: string | null
          descricao: string
          descricao_status: string | null
          extras: Json
          id: string
          id_atividade: string | null
          importacao_id: string | null
          inicio_atividade: string | null
          localizacao: string | null
          numero: number
          obra_id: string
          observacoes: string | null
          origem: Database["public"]["Enums"]["6wla_restricao_origem"]
          prazo_original: string | null
          previsao_conclusao: string | null
          prioridade: Database["public"]["Enums"]["6wla_restricao_prioridade"]
          reprogramacoes: number
          responsavel_email: string | null
          responsavel_id: string | null
          responsavel_nome: string | null
          responsavel_telefone: string | null
          semana_programada: string | null
          setor: string | null
          status: Database["public"]["Enums"]["6wla_restricao_status"]
        }
        Insert: {
          acao?: string | null
          area?: string | null
          atividade_impactada?: string | null
          atualizado_em?: string
          causa_6m?: string | null
          classificacao?: string | null
          codigo?: string | null
          criado_em?: string
          criado_por?: string | null
          data_conclusao?: string | null
          data_criacao?: string
          data_limite?: string | null
          descricao: string
          descricao_status?: string | null
          extras?: Json
          id?: string
          id_atividade?: string | null
          importacao_id?: string | null
          inicio_atividade?: string | null
          localizacao?: string | null
          numero?: number
          obra_id: string
          observacoes?: string | null
          origem?: Database["public"]["Enums"]["6wla_restricao_origem"]
          prazo_original?: string | null
          previsao_conclusao?: string | null
          prioridade?: Database["public"]["Enums"]["6wla_restricao_prioridade"]
          reprogramacoes?: number
          responsavel_email?: string | null
          responsavel_id?: string | null
          responsavel_nome?: string | null
          responsavel_telefone?: string | null
          semana_programada?: string | null
          setor?: string | null
          status?: Database["public"]["Enums"]["6wla_restricao_status"]
        }
        Update: {
          acao?: string | null
          area?: string | null
          atividade_impactada?: string | null
          atualizado_em?: string
          causa_6m?: string | null
          classificacao?: string | null
          codigo?: string | null
          criado_em?: string
          criado_por?: string | null
          data_conclusao?: string | null
          data_criacao?: string
          data_limite?: string | null
          descricao?: string
          descricao_status?: string | null
          extras?: Json
          id?: string
          id_atividade?: string | null
          importacao_id?: string | null
          inicio_atividade?: string | null
          localizacao?: string | null
          numero?: number
          obra_id?: string
          observacoes?: string | null
          origem?: Database["public"]["Enums"]["6wla_restricao_origem"]
          prazo_original?: string | null
          previsao_conclusao?: string | null
          prioridade?: Database["public"]["Enums"]["6wla_restricao_prioridade"]
          reprogramacoes?: number
          responsavel_email?: string | null
          responsavel_id?: string | null
          responsavel_nome?: string | null
          responsavel_telefone?: string | null
          semana_programada?: string | null
          setor?: string | null
          status?: Database["public"]["Enums"]["6wla_restricao_status"]
        }
        Relationships: [
          {
            foreignKeyName: "6wla_restricoes_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "6wla_perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "6wla_restricoes_importacao_id_fkey"
            columns: ["importacao_id"]
            isOneToOne: false
            referencedRelation: "6wla_importacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "6wla_restricoes_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "6wla_obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "6wla_restricoes_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "6wla_perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      "6wla_workspaces": {
        Row: {
          ativo: boolean
          codigo: string
          criado_em: string
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          codigo: string
          criado_em?: string
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          codigo?: string
          criado_em?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      "6wla_auth_id_por_email": { Args: { p_email: string }; Returns: string }
      "6wla_encerra_sessoes": { Args: { p_user: string }; Returns: undefined }
      "6wla_reivindica_envios": {
        Args: { p_limite: number; p_obra_id: string }
        Returns: {
            agendado_para: string
            assunto: string
            automacao_id: string
            confirmado_em: string | null
            copias: string[]
            criado_em: string
            destinatario: string
            entregue_em: string | null
            erro: string | null
            id: string
            status: string
            teste: boolean
            total_itens: number
        }[]
      }
    }
    Enums: {
      "6wla_evento_tipo": "criada" | "alteracao" | "importada"
      "6wla_importacao_modo": "adicionar" | "atualizar"
      "6wla_importacao_status": "rascunho" | "concluida" | "cancelada"
      "6wla_notificacao_tipo": "mencao" | "atribuicao" | "comentario"
      "6wla_restricao_origem": "manual" | "importada"
      "6wla_restricao_prioridade": "urgente" | "alta" | "media" | "baixa"
      "6wla_restricao_status":
        | "pendente"
        | "em_andamento"
        | "concluida"
        | "cancelada"
      "6wla_workspace_papel": "admin" | "gestor" | "membro"
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
      "6wla_evento_tipo": ["criada", "alteracao", "importada"],
      "6wla_importacao_modo": ["adicionar", "atualizar"],
      "6wla_importacao_status": ["rascunho", "concluida", "cancelada"],
      "6wla_notificacao_tipo": ["mencao", "atribuicao", "comentario"],
      "6wla_restricao_origem": ["manual", "importada"],
      "6wla_restricao_prioridade": ["urgente", "alta", "media", "baixa"],
      "6wla_restricao_status": [
        "pendente",
        "em_andamento",
        "concluida",
        "cancelada",
      ],
      "6wla_workspace_papel": ["admin", "gestor", "membro"],
    },
  },
} as const

