-- =====================================================================
-- Ink & Glow Studio — dados de exemplo (APENAS DESENVOLVIMENTO)
--
-- Usuários e senhas de teste (hash bcrypt, custo 10, gerado com
-- `npx ts-node scripts/gerarHashSenha.ts <senha>`):
--   admin      / admin123        (ADMIN)
--   recepcao   / recepcao123     (RECEPCAO)
--   tatuador   / tatuador123     (PROFISSIONAL - TATUADOR)
--   esteticista/ esteticista123  (PROFISSIONAL - ESTETICISTA)
-- Troque essas senhas antes de qualquer uso real.
--
-- CPFs são fictícios, porém com dígitos verificadores válidos.
-- Datas de agendamentos são relativas a CURDATE() para o seed continuar
-- com agendamentos passados e futuros em qualquer dia em que for rodado.
-- =====================================================================

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------
-- usuarios
-- ---------------------------------------------------------------------
INSERT INTO usuarios (id, nome, cpf, email, telefone, login, senha_hash, perfil, especialidade) VALUES
  (1, 'Administrador do Estúdio', '52998224725', 'admin@inkglow.local',       '11987650001', 'admin',       '$2a$10$R1BgTB73bDGnAVkQJ/C2wuSr1o.woDGmA8BeS.k4dAU/yfhvip6AC', 'ADMIN',        NULL),
  (2, 'Renata Souza',             '11144477735', 'recepcao@inkglow.local',    '11987650002', 'recepcao',    '$2a$10$hHtHu2AzDt3BG7K9QBYHYeDPq1OxqyaK3StRLGTyqNmoea/ailAm2', 'RECEPCAO',     NULL),
  (3, 'Diego Lima',               '93541134780', 'diego@inkglow.local',       '11987650003', 'tatuador',    '$2a$10$ZQCWS86VDHAmWUt.1gSz8uI6gcSyLLNCISAm3NKK8/pJHPehpBe0K', 'PROFISSIONAL', 'TATUADOR'),
  (4, 'Camila Rocha',             '12345678909', 'camila@inkglow.local',      '11987650004', 'esteticista', '$2a$10$m4Kdp8vjIrklnhSbzXl4HO7CnAZ.GBRPI97pNJu3yI9jS30jQBs26', 'PROFISSIONAL', 'ESTETICISTA');

-- ---------------------------------------------------------------------
-- servicos
-- ---------------------------------------------------------------------
INSERT INTO servicos (id, nome, descricao, categoria, duracao_minutos, preco) VALUES
  (1, 'Tatuagem fine line',         'Traço fino, peças pequenas e delicadas.',            'TATUAGEM', 180, 450.00),
  (2, 'Tatuagem colorida média',    'Peça colorida de 10 a 20 cm.',                        'TATUAGEM', 240, 800.00),
  (3, 'Retoque de tatuagem',        'Retoque de traço e cor até 60 dias após a sessão.',  'TATUAGEM',  60, 150.00),
  (4, 'Limpeza de pele profunda',   'Higienização, extração e máscara calmante.',         'ESTETICA',  90, 180.00),
  (5, 'Peeling químico',            'Renovação celular com ácidos.',                       'ESTETICA',  60, 220.00),
  (6, 'Design de sobrancelha',      'Design com pinça e henna.',                           'ESTETICA',  45,  90.00);

-- ---------------------------------------------------------------------
-- profissional_servicos (N:N)
-- ---------------------------------------------------------------------
INSERT INTO profissional_servicos (profissional_id, servico_id) VALUES
  (3, 1), (3, 2), (3, 3),
  (4, 4), (4, 5), (4, 6);

-- ---------------------------------------------------------------------
-- clientes
-- ---------------------------------------------------------------------
INSERT INTO clientes (id, nome, cpf, data_nascimento, telefone, email, observacoes, cep, logradouro, numero, complemento, bairro, cidade, uf) VALUES
  (1, 'Ana Beatriz Martins', '98765432100', '1995-03-14', '11991230001', 'ana.martins@exemplo.com',  'Prefere horários à tarde.',      '01310100', 'Avenida Paulista',       '1000', 'Apto 52', 'Bela Vista',      'São Paulo',      'SP'),
  (2, 'Bruno Carvalho',      '24681357928', '1988-11-02', '11991230002', 'bruno.carvalho@exemplo.com', NULL,                           '20040020', 'Avenida Rio Branco',     '45',   NULL,      'Centro',          'Rio de Janeiro', 'RJ'),
  (3, 'Carla Nogueira',      '13579246828', '2001-07-21', '11991230003', 'carla.nogueira@exemplo.com', 'Pele sensível a ácidos fortes.', '30130010', 'Praça Sete de Setembro', '12',   'Sala 3',  'Centro',          'Belo Horizonte', 'MG'),
  (4, 'Daniel Ferreira',     '31415926590', '1999-01-30', '11991230004', 'daniel.ferreira@exemplo.com', NULL,                          '80010000', 'Praça Tiradentes',       '200',  NULL,      'Centro',          'Curitiba',       'PR'),
  (5, 'Eduarda Prado',       '27182818205', '1992-09-09', '11991230005', 'eduarda.prado@exemplo.com', 'Alergia a látex.',               '90010150', 'Rua dos Andradas',       '1234', NULL,      'Centro Histórico','Porto Alegre',   'RS');

-- ---------------------------------------------------------------------
-- materiais (cotação de exemplo: 1 USD = 5,4200 BRL)
-- ---------------------------------------------------------------------
INSERT INTO materiais (id, nome, categoria, unidade, quantidade_atual, estoque_minimo, preco_custo_usd, preco_custo_brl, cotacao_usada, cotacao_em, fornecedor) VALUES
  (1, 'Tinta preta tribal 240ml',       'TATUAGEM', 'frasco',  6.00,  3.00, 18.50, 100.27, 5.4200, NOW(), 'Ink Supply Co.'),
  (2, 'Agulha cartucho RL 3 (cx 20)',   'TATUAGEM', 'caixa',   4.00,  5.00, 24.90, 134.96, 5.4200, NOW(), 'Ink Supply Co.'),
  (3, 'Luva nitrílica preta (cx 100)',  'TATUAGEM', 'caixa',  10.00,  4.00,  9.80,  53.12, 5.4200, NOW(), 'Distribuidora Saúde'),
  (4, 'Filme protetor pós-tattoo',      'TATUAGEM', 'rolo',    3.00,  2.00, 15.00,  81.30, 5.4200, NOW(), 'Ink Supply Co.'),
  (5, 'Sérum vitamina C 30ml',          'ESTETICA', 'frasco',  8.00,  3.00, 32.00, 173.44, 5.4200, NOW(), 'DermaPro'),
  (6, 'Ácido glicólico 70% 50ml',       'ESTETICA', 'frasco',  2.00,  2.00, 27.50, 149.05, 5.4200, NOW(), 'DermaPro'),
  (7, 'Máscara de argila verde 500g',   'ESTETICA', 'pote',    5.00,  2.00, 12.40,  67.21, 5.4200, NOW(), 'Beleza Natural'),
  (8, 'Algodão em disco (pct 100)',     'ESTETICA', 'pacote', 20.00,  5.00, NULL,    12.90, NULL,   NULL,  'Distribuidora Saúde');

-- ---------------------------------------------------------------------
-- agendamentos (passados concluídos/faltou e futuros)
-- ---------------------------------------------------------------------
INSERT INTO agendamentos (id, cliente_id, profissional_id, servico_id, data_hora_inicio, data_hora_fim, status, valor_cobrado, observacoes) VALUES
  (1, 1, 3, 1, TIMESTAMP(CURDATE() - INTERVAL 20 DAY, '14:00:00'), TIMESTAMP(CURDATE() - INTERVAL 20 DAY, '17:00:00'), 'CONCLUIDO', 450.00, 'Fine line no antebraço.'),
  (2, 3, 4, 4, TIMESTAMP(CURDATE() - INTERVAL 12 DAY, '10:00:00'), TIMESTAMP(CURDATE() - INTERVAL 12 DAY, '11:30:00'), 'CONCLUIDO', 180.00, NULL),
  (3, 2, 3, 2, TIMESTAMP(CURDATE() - INTERVAL 7 DAY,  '13:00:00'), TIMESTAMP(CURDATE() - INTERVAL 7 DAY,  '17:00:00'), 'CONCLUIDO', 760.00, 'Desconto de 5% para cliente recorrente.'),
  (4, 4, 4, 6, TIMESTAMP(CURDATE() - INTERVAL 3 DAY,  '15:00:00'), TIMESTAMP(CURDATE() - INTERVAL 3 DAY,  '15:45:00'), 'FALTOU',    NULL,   NULL),
  (5, 1, 3, 3, TIMESTAMP(CURDATE() + INTERVAL 1 DAY,  '10:00:00'), TIMESTAMP(CURDATE() + INTERVAL 1 DAY,  '11:00:00'), 'CONFIRMADO', NULL,  'Retoque da fine line.'),
  (6, 5, 4, 5, TIMESTAMP(CURDATE() + INTERVAL 1 DAY,  '14:00:00'), TIMESTAMP(CURDATE() + INTERVAL 1 DAY,  '15:00:00'), 'AGENDADO',  NULL,   'Cliente com alergia a látex: usar luva nitrílica.'),
  (7, 2, 3, 1, TIMESTAMP(CURDATE() + INTERVAL 5 DAY,  '16:00:00'), TIMESTAMP(CURDATE() + INTERVAL 5 DAY,  '19:00:00'), 'AGENDADO',  NULL,   NULL),
  (8, 3, 4, 6, TIMESTAMP(CURDATE() + INTERVAL 9 DAY,  '11:00:00'), TIMESTAMP(CURDATE() + INTERVAL 9 DAY,  '11:45:00'), 'CANCELADO', NULL,   'Cancelado pela cliente.');

-- ---------------------------------------------------------------------
-- movimentacoes_estoque (entradas iniciais e saídas ligadas a atendimentos)
-- ---------------------------------------------------------------------
INSERT INTO movimentacoes_estoque (material_id, agendamento_id, usuario_id, tipo, quantidade, motivo) VALUES
  (1, NULL, 1, 'ENTRADA', 7.00,  'Compra inicial'),
  (2, NULL, 1, 'ENTRADA', 6.00,  'Compra inicial'),
  (3, NULL, 1, 'ENTRADA', 12.00, 'Compra inicial'),
  (5, NULL, 1, 'ENTRADA', 8.00,  'Compra inicial'),
  (7, NULL, 1, 'ENTRADA', 6.00,  'Compra inicial'),
  (1, 1,    3, 'SAIDA',   1.00,  'Consumo no atendimento'),
  (2, 1,    3, 'SAIDA',   1.00,  'Consumo no atendimento'),
  (3, 1,    3, 'SAIDA',   1.00,  'Consumo no atendimento'),
  (7, 2,    4, 'SAIDA',   1.00,  'Consumo no atendimento'),
  (2, 3,    3, 'SAIDA',   1.00,  'Consumo no atendimento'),
  (3, 3,    3, 'SAIDA',   1.00,  'Consumo no atendimento');

-- ---------------------------------------------------------------------
-- lembretes (1 dia antes, às 09:00)
-- ---------------------------------------------------------------------
INSERT INTO lembretes (agendamento_id, canal, destinatario, status, tentativas, agendado_para, enviado_em, erro) VALUES
  (1, 'EMAIL', 'ana.martins@exemplo.com',     'ENVIADO', 1, TIMESTAMP(CURDATE() - INTERVAL 21 DAY, '09:00:00'), TIMESTAMP(CURDATE() - INTERVAL 21 DAY, '09:00:05'), NULL),
  (3, 'EMAIL', 'bruno.carvalho@exemplo.com',  'FALHA',   3, TIMESTAMP(CURDATE() - INTERVAL 8 DAY,  '09:00:00'), NULL, 'SMTP indisponível (exemplo)'),
  (5, 'EMAIL', 'ana.martins@exemplo.com',     'PENDENTE', 0, TIMESTAMP(CURDATE(), '09:00:00'), NULL, NULL),
  (6, 'EMAIL', 'eduarda.prado@exemplo.com',   'PENDENTE', 0, TIMESTAMP(CURDATE(), '09:00:00'), NULL, NULL);
