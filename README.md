# BBY Mila Nails

Site da marca Bby Mila Nails, organizado em páginas independentes.

## Visualizar

Abra `index.html` diretamente no navegador ou utilize uma extensão de servidor local no VS Code.

## Páginas

- `index.html` — apresentação resumida da marca.
- `studio.html` — procedimentos, preços, nail art e portfólio.
- `academy.html` — cursos Duo e Nail Art.
- `modelos.html` — Programa de Modelos.
- `sobre.html` — proposta e identidade da marca.
- `contato.html` — canais de contato e endereço.
- `admin.html` — login administrativo.
- `dashboard.html` — painel da administração.

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

### Coleções e campos

- `agendamentos`: dados completos das reservas; `nome`, `telefone` (somente dígitos), `email`, `procedimento`, `data` (`AAAA-MM-DD`), `horario` (`HH:MM`), `status`, `criadoEm`, `slotId`, `codigoConsulta` e, quando informado no painel, `valor`.
- `horarios_ocupados`: disponibilidade pública sem dados pessoais; apenas `data`, `horario`, `status` e o identificador aleatório `reservaId`. O agendamento público consulta essa coleção e cria o horário, a reserva e a consulta de forma atômica.
- `consultas_agendamento`: documento identificado por um código aleatório de 64 caracteres hexadecimais; contém apenas `data`, `horario`, `procedimento`, `status` e `reservaId`. A consulta pública aceita somente a leitura de um documento (`get`) usando esse código; listagem é negada. O código funciona como uma chave privada: a cliente deve guardá-lo.
- `clientes`: `nome`, `telefone`, `email`, `instagram`, `ativo` e `criadoEm`.
- `servicos`: `nome`, `descricao`, `valor`, `duracao`, `ativo` e `criadoEm`.
- `configuracoes/agenda`: `mesesAbertos` e `horariosPadrao`. Esses dados de disponibilidade são públicos; apenas a administradora pode alterá-los. As demais coleções/documentos sem exceção explícita são administrativos e ficam restritos à UID autorizada.

As regras impedem leitura pública dos dados pessoais em `agendamentos`. Por isso, a consulta antiga pelo telefone foi substituída pelo código secreto mostrado após a solicitação. Na primeira abertura do Dashboard autorizado, reservas antigas ativas são sincronizadas com `horarios_ocupados` e recebem um código de consulta que a equipe pode copiar e compartilhar com a cliente. O painel calcula faturamento realizado somando o campo `valor` de agendamentos marcados como concluídos; não cria uma coleção `financeiro` nem inventa avaliações.
