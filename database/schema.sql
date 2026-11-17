-- =====================================================================
-- Ink & Glow Studio — schema MySQL (8 tabelas)
-- Requer MySQL 8.0.16+ (CHECK constraints). Engine InnoDB, utf8mb4.
-- O banco (DB_NAME do .env) é criado/selecionado por scripts/initDb.ts.
-- Exclusão lógica via coluna `ativo`; registros com histórico não são apagados.
-- =====================================================================

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------
-- 1. usuarios — ADMIN, RECEPCAO e PROFISSIONAL (tatuador/esteticista)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome              VARCHAR(120) NOT NULL,
  cpf               CHAR(11)     NULL,
  email             VARCHAR(150) NOT NULL,
  telefone          VARCHAR(20)  NULL,
  login             VARCHAR(50)  NOT NULL,
  senha_hash        VARCHAR(100) NOT NULL,
  perfil            ENUM('ADMIN','RECEPCAO','PROFISSIONAL') NOT NULL,
  especialidade     ENUM('TATUADOR','ESTETICISTA') NULL,
  tentativas_login  TINYINT UNSIGNED NOT NULL DEFAULT 0,
  bloqueado_ate     DATETIME     NULL,
  ultimo_acesso     DATETIME     NULL,
  ativo             TINYINT(1)   NOT NULL DEFAULT 1,
  created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_usuarios_login (login),
  UNIQUE KEY uq_usuarios_email (email),
  UNIQUE KEY uq_usuarios_cpf (cpf),
  KEY idx_usuarios_perfil_ativo (perfil, ativo),
  KEY idx_usuarios_nome (nome),
  CONSTRAINT ck_usuarios_especialidade CHECK (
    (perfil = 'PROFISSIONAL' AND especialidade IS NOT NULL)
    OR (perfil <> 'PROFISSIONAL' AND especialidade IS NULL)
  ),
  CONSTRAINT ck_usuarios_cpf CHECK (cpf IS NULL OR cpf REGEXP '^[0-9]{11}$')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 2. clientes — não fazem login; endereço preenchido via ViaCEP
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clientes (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome             VARCHAR(120) NOT NULL,
  cpf              CHAR(11)     NOT NULL,
  data_nascimento  DATE         NOT NULL,
  telefone         VARCHAR(20)  NULL,
  email            VARCHAR(150) NULL,
  observacoes      TEXT         NULL,
  cep              CHAR(8)      NULL,
  logradouro       VARCHAR(150) NULL,
  numero           VARCHAR(10)  NULL,
  complemento      VARCHAR(80)  NULL,
  bairro           VARCHAR(80)  NULL,
  cidade           VARCHAR(80)  NULL,
  uf               CHAR(2)      NULL,
  ativo            TINYINT(1)   NOT NULL DEFAULT 1,
  created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_clientes_cpf (cpf),
  KEY idx_clientes_nome (nome),
  KEY idx_clientes_ativo (ativo),
  CONSTRAINT ck_clientes_cpf CHECK (cpf REGEXP '^[0-9]{11}$'),
  CONSTRAINT ck_clientes_cep CHECK (cep IS NULL OR cep REGEXP '^[0-9]{8}$')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 3. servicos — procedimentos oferecidos (preço em BRL)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS servicos (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome             VARCHAR(120) NOT NULL,
  descricao        VARCHAR(500) NULL,
  categoria        ENUM('TATUAGEM','ESTETICA') NOT NULL,
  duracao_minutos  SMALLINT UNSIGNED NOT NULL,
  preco            DECIMAL(10,2) NOT NULL,
  ativo            TINYINT(1)   NOT NULL DEFAULT 1,
  created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_servicos_nome (nome),
  KEY idx_servicos_categoria_ativo (categoria, ativo),
  CONSTRAINT ck_servicos_duracao CHECK (duracao_minutos > 0),
  CONSTRAINT ck_servicos_preco CHECK (preco >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 4. profissional_servicos — N:N entre profissionais (usuarios) e servicos
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profissional_servicos (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  profissional_id  INT UNSIGNED NOT NULL,
  servico_id       INT UNSIGNED NOT NULL,
  ativo            TINYINT(1)   NOT NULL DEFAULT 1,
  created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_prof_serv (profissional_id, servico_id),
  KEY idx_prof_serv_servico (servico_id),
  CONSTRAINT fk_prof_serv_profissional FOREIGN KEY (profissional_id)
    REFERENCES usuarios (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_prof_serv_servico FOREIGN KEY (servico_id)
    REFERENCES servicos (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 5. agendamentos — agenda e histórico de atendimentos
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agendamentos (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  cliente_id        INT UNSIGNED NOT NULL,
  profissional_id   INT UNSIGNED NOT NULL,
  servico_id        INT UNSIGNED NOT NULL,
  data_hora_inicio  DATETIME     NOT NULL,
  data_hora_fim     DATETIME     NOT NULL,
  status            ENUM('AGENDADO','CONFIRMADO','CONCLUIDO','CANCELADO','FALTOU') NOT NULL DEFAULT 'AGENDADO',
  valor_cobrado     DECIMAL(10,2) NULL,
  observacoes       TEXT         NULL,
  ativo             TINYINT(1)   NOT NULL DEFAULT 1,
  created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_agend_profissional_inicio (profissional_id, data_hora_inicio),
  KEY idx_agend_cliente (cliente_id),
  KEY idx_agend_servico (servico_id),
  KEY idx_agend_inicio (data_hora_inicio),
  KEY idx_agend_status (status),
  CONSTRAINT fk_agend_cliente FOREIGN KEY (cliente_id)
    REFERENCES clientes (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_agend_profissional FOREIGN KEY (profissional_id)
    REFERENCES usuarios (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_agend_servico FOREIGN KEY (servico_id)
    REFERENCES servicos (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT ck_agend_periodo CHECK (data_hora_fim > data_hora_inicio),
  CONSTRAINT ck_agend_valor CHECK (valor_cobrado IS NULL OR valor_cobrado >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 6. materiais — estoque com preço de custo em USD e BRL
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS materiais (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome              VARCHAR(120) NOT NULL,
  categoria         ENUM('TATUAGEM','ESTETICA') NOT NULL,
  unidade           VARCHAR(20)  NOT NULL,
  quantidade_atual  DECIMAL(10,2) NOT NULL DEFAULT 0,
  estoque_minimo    DECIMAL(10,2) NOT NULL DEFAULT 0,
  preco_custo_usd   DECIMAL(10,2) NULL,
  preco_custo_brl   DECIMAL(10,2) NULL,
  cotacao_usada     DECIMAL(10,4) NULL,
  cotacao_em        DATETIME     NULL,
  fornecedor        VARCHAR(120) NULL,
  ativo             TINYINT(1)   NOT NULL DEFAULT 1,
  created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_materiais_nome (nome),
  KEY idx_materiais_categoria_ativo (categoria, ativo),
  CONSTRAINT ck_materiais_quantidade CHECK (quantidade_atual >= 0),
  CONSTRAINT ck_materiais_minimo CHECK (estoque_minimo >= 0),
  CONSTRAINT ck_materiais_precos CHECK (
    (preco_custo_usd IS NULL OR preco_custo_usd >= 0)
    AND (preco_custo_brl IS NULL OR preco_custo_brl >= 0)
    AND (cotacao_usada IS NULL OR cotacao_usada > 0)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 7. movimentacoes_estoque — entradas e saídas (saída pode vir de um atendimento)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS movimentacoes_estoque (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  material_id     INT UNSIGNED NOT NULL,
  agendamento_id  INT UNSIGNED NULL,
  usuario_id      INT UNSIGNED NULL,
  tipo            ENUM('ENTRADA','SAIDA') NOT NULL,
  quantidade      DECIMAL(10,2) NOT NULL,
  motivo          VARCHAR(255) NULL,
  ativo           TINYINT(1)   NOT NULL DEFAULT 1,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_mov_material_data (material_id, created_at),
  KEY idx_mov_agendamento (agendamento_id),
  KEY idx_mov_usuario (usuario_id),
  CONSTRAINT fk_mov_material FOREIGN KEY (material_id)
    REFERENCES materiais (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_mov_agendamento FOREIGN KEY (agendamento_id)
    REFERENCES agendamentos (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_mov_usuario FOREIGN KEY (usuario_id)
    REFERENCES usuarios (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT ck_mov_quantidade CHECK (quantidade > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 8. lembretes — envio de lembrete 1 dia antes do agendamento
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lembretes (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  agendamento_id  INT UNSIGNED NOT NULL,
  canal           ENUM('EMAIL') NOT NULL DEFAULT 'EMAIL',
  destinatario    VARCHAR(150) NULL,
  status          ENUM('PENDENTE','ENVIADO','FALHA') NOT NULL DEFAULT 'PENDENTE',
  tentativas      TINYINT UNSIGNED NOT NULL DEFAULT 0,
  agendado_para   DATETIME     NOT NULL,
  enviado_em      DATETIME     NULL,
  erro            VARCHAR(500) NULL,
  ativo           TINYINT(1)   NOT NULL DEFAULT 1,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_lembretes_agend_canal (agendamento_id, canal),
  KEY idx_lembretes_status_agendado (status, agendado_para),
  CONSTRAINT fk_lembretes_agendamento FOREIGN KEY (agendamento_id)
    REFERENCES agendamentos (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
