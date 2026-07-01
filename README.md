# FOCO7

App de finanças pessoais multiusuário, com dashboard interativo, controle de saldos, gastos, faturas e gestão de devedores.

🔗 **Acesse:** https://foco7.vercel.app/

## Sobre o projeto

O FOCO7 nasceu da necessidade de centralizar o controle financeiro pessoal em um único lugar: saldos em conta, contas fixas, gastos variáveis, faturas de cartão e valores a receber de terceiros. O app oferece uma visão consolidada através de um dashboard com gráficos e indicadores em tempo real.

## Funcionalidades

- **Dashboard** com visão geral: saldo total, total de saídas, valores a receber e gráficos de gastos por categoria
- **Gestão de Saldos**: controle de múltiplas contas e reservas (ex: reserva de emergência, investimentos)
- **Gastos**: registro de contas fixas e despesas variáveis
- **Faturas**: controle de faturas por banco, com isolamento de estado entre cartões
- **Devedores**: vínculo entre valores a receber e faturas/contas específicas
- **Entradas e Saídas**: navegação mensal com composição detalhada de receitas e despesas

## Tecnologias

- React + Vite
- Supabase (autenticação e banco de dados)
- Recharts (visualização de dados)
- Deploy na Vercel

<img width="800" alt="image" src="https://github.com/user-attachments/assets/59e2309d-8fdc-4dbe-a674-5febbb8c0b52" />

<img width="800" alt="image" src="https://github.com/user-attachments/assets/516ff467-29e2-4b93-ab7d-0317c0caf63e" />

<img width="800" alt="image" src="https://github.com/user-attachments/assets/53f73905-cebf-4df8-908a-1c9b95538dfb" />

```bash
git clone https://github.com/pecora77/Foco7.git
cd Foco7
npm install
npm run dev
```

Você vai precisar configurar suas próprias variáveis de ambiente do Supabase em um arquivo `.env` na raiz do projeto (não incluído no repositório por segurança).

## Autor

Desenvolvido por [Pedro Pécora](https://github.com/pecora77)
