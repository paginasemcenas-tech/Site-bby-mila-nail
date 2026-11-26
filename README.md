# BBY Mila Nails

Site da marca Bby Mila Nails, organizado em páginas independentes.

## Visualizar

Sirva o projeto por HTTP/HTTPS (por exemplo, com Live Server no VS Code) e abra `index.html` no navegador.

## Páginas

- `index.html` — apresentação resumida da marca.
- `studio.html` — procedimentos, preços, nail art e portfólio.
- `academy.html` — cursos Duo e Nail Art.
- `sobre.html` — proposta e identidade da marca.
- `contato.html` — canais de contato e endereço.
- `admin.html` — login administrativo.
- `dashboard.html` — painel da administração e das profissionais parceiras.
- `cliente-dashboard.html` — painel da cliente e atalho para novo agendamento.

## Dados configurados

- WhatsApp: (31) 9680-9579
- Instagram: @bbymilanails
- Endereço: Avenida Augusto de Lima, 1376 - Barro Preto, Belo Horizonte - MG

## Firebase, agendamento e administração

O projeto usa Firebase Authentication e Cloud Firestore com SDK modular. O app Web já está centralizado em `firebase-config.js`; os valores Firebase Web são identificadores públicos do app, não substituem regras de segurança. Se usar outro projeto, substitua os valores de `firebaseConfig`.

### Configuração passo a passo

1. No Firebase Console, abra **Configurações do projeto → Geral → Seus apps → app da Web** e copie o objeto `firebaseConfig` para `firebase-config.js`.
2. Em **Authentication → Sign-in method**, ative **E-mail/senha**. Em **Authentication → Users**, adicione a conta administrativa da Camila e copie o UID exibido na linha dessa conta.
3. Substitua `SUBSTITUA_PELA_UID_DA_CAMILA` pelo UID real nos dois lugares:
   - `adminUIDs` em `firebase-config.js`.
   - Lista permitida dentro da função `isAdmin()` em `firestore.rules`.
4. Em **Firestore Database**, crie o banco em modo produção. Abra a aba **Rules**, cole as regras de `firestore.rules` com o UID real e clique em **Publish**. Não use regras abertas como `allow read, write: if true`.
5. Crie o documento `configuracoes/agenda` com:
   - `mesesAbertos`: array, por exemplo `["2026-11", "2026-12"]`.
   - `horariosPadrao`: array de strings `HH:MM`, por exemplo `["09:00", "10:30", "13:00"]`.
6. Sirva o site por HTTP/HTTPS (por exemplo, Live Server no VS Code); os módulos ES e o Firebase não funcionam de forma confiável em `file://`.
7. Abra `/admin.html`, entre com a conta criada e use `/dashboard.html` para o painel. A rota e o conteúdo da tela não substituem as regras do Firestore; a autorização dos dados é feita pelas Rules.

### Profissionais parceiras

1. Crie uma conta individual para cada profissional em **Authentication → Users**, com e-mail e senha.
2. Entre no Dashboard como administradora, abra **Configurações → Cadastro de parceiras** e informe o UID e o nome exibido da conta.
3. A profissional pode entrar em `/admin.html`. O painel mostra apenas os agendamentos, horários e valores daquela profissional; a lista de clientes é compartilhada. Conteúdo do site, catálogo de serviços, configuração mensal da agenda e cadastro da equipe são exclusivos da administradora.
4. Para suspender ou remover o acesso, use as ações da tabela de parceiras. Isso não exclui a conta de autenticação.

As regras atuais mantêm a UID da administradora em `isAdmin()` e permitem que ela cadastre parceiras pela interface. Publique `firestore.rules` no Console do Firebase após alterar o projeto ou as regras.

### Coleções e campos

- `agendamentos`: dados das reservas; `nome`, `telefone`, `email`, `procedimento`, `data` (`AAAA-MM-DD`), `horario`, `status`, `criadoEm`, `slotId`, `codigoConsulta`, `valor`, `profissionalUid` e `profissionalNome`. Reservas públicas também guardam `clienteUid`, `servicoId` e os campos de aceite do Aviso de Privacidade.
- `horarios_ocupados`: disponibilidade sem dados pessoais. Reservas usam slots identificados por data, horário e UID da profissional; bloqueios podem ser específicos da profissional ou globais. O agendamento público cria o horário, a reserva e a consulta de forma atômica.
- `consultas_agendamento`: documento identificado por um código aleatório de 64 caracteres hexadecimais; contém apenas `data`, `horario`, `procedimento`, `status` e `reservaId`. A consulta pública aceita somente a leitura de um documento (`get`) usando esse código; listagem é negada. O código funciona como uma chave privada: a cliente deve guardá-lo.
- `clientes`: perfil compartilhado; `nome`, `telefone`, `email`, `instagram`, `ativo` e `criadoEm`. As profissionais podem consultar a lista de clientes, mas cada uma vê apenas seus próprios agendamentos.
- `servicos`: catálogo com `nome`, `descricao`, `valor`, `duracao` e `ativo`. Serviços ativos alimentam a tabela pública de preços e o formulário de agendamento; alterações aparecem em tempo real nas páginas abertas.
- `profissionais/{uid}`: cadastro de acesso com `nome`, `ativo` e datas de atualização. Apenas a administradora pode alterar esses perfis.
- `conteudo_site/{pagina}`: textos e caminhos/URLs de imagens editáveis no Dashboard e publicados nas páginas públicas.
- `configuracoes/agenda`: `mesesAbertos` e `horariosPadrao`. A disponibilidade é pública; apenas a administradora pode alterá-la. `configuracoes/perfil_studio` guarda os dados do perfil da administradora.

As regras impedem leitura pública dos dados pessoais em `agendamentos`. Por isso, a consulta antiga pelo telefone foi substituída pelo código secreto mostrado após a solicitação. Na primeira abertura do Dashboard administrativo, reservas antigas ativas são sincronizadas com `horarios_ocupados` e recebem um código de consulta que a equipe pode copiar e compartilhar com a cliente. O painel calcula faturamento realizado somando o campo `valor` de agendamentos concluídos; cada profissional vê somente o próprio financeiro.
