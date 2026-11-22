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

## Dados configurados

- WhatsApp: (31) 9680-9579
- Instagram: @bbymilanails
- Endereço: Avenida Augusto de Lima, 1376 - Barro Preto, Belo Horizonte - MG

## Firebase e agenda

1. Copie os dados do app Web do Firebase para `firebase-config.js`.
2. Ative Email/Senha no Firebase Authentication e crie a conta da administradora.
3. Crie `configuracoes/agenda` com `mesesAbertos` (array de meses `AAAA-MM`) e `horariosPadrao` (array de horários `HH:MM`).
4. Publique o site por um servidor HTTP/HTTPS; os módulos Firebase não funcionam de forma confiável ao abrir o HTML diretamente como `file://`.
5. Acesse diretamente `<domínio-do-site>/admin.html` para entrar no painel. O endereço não é divulgado nem ligado nas páginas públicas; salve-o nos favoritos da administradora.
6. Entre com a conta criada no Firebase Authentication. No painel, é possível abrir ou fechar meses e gerenciar os agendamentos.

Os agendamentos são gravados em `agendamentos` com `nome`, `telefone` (somente dígitos), `email`, `procedimento`, `data` (`AAAA-MM-DD`), `horario`, `status` e `criadoEm`.

Antes de publicar, configure regras do Firestore que restrinjam a leitura e alteração de agendamentos e da agenda à administradora. A tela de login protege a interface, mas as regras do Firestore são necessárias para proteger os dados. A consulta pública por disponibilidade e telefone usa a coleção `agendamentos`; expor essas consultas sem uma camada de servidor pode revelar dados pessoais de outras clientes. Para produção, mova essas consultas para Cloud Functions ou mantenha uma coleção pública de disponibilidade sem dados pessoais.
