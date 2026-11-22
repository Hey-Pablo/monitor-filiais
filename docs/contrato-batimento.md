# Contrato do Batimento

O agente envia um sinal de vida (batimento) a cada 60 segundos para a API central. O corpo segue este esquema JSON.

## Endpoint

```
POST /api/ingestao/batimento
Content-Type: application/json
Authorization: Bearer <token-da-filial>
```

## Payload (JSON)

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| filialId | string | sim | Identificador único da filial (ex.: `filial-sp-01`) |
| timestamp | string (ISO 8601) | sim | Horário da coleta no agente (UTC) |
| cpu | number | sim | Percentual de uso de CPU (0–100) |
| memoria | number | sim | Percentual de uso de memória RAM (0–100) |
| discoLivrePercentual | number | sim | Percentual de espaço livre no disco do sistema (0–100) |
| servicos | array de objetos | sim | Lista de serviços monitorados |
| latenciaMs | number | opcional | Latência de rede até a API em milissegundos |

### Objeto `servicos[i]`

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| nome | string | sim | Nome do serviço (ex.: `spooler`, `wuauserv`) |
| status | string | sim | `running`, `stopped`, `paused`, `unknown` |

## Exemplo de payload

```json
{
  "filialId": "filial-sp-01",
  "timestamp": "2025-06-15T14:30:00.123Z",
  "cpu": 12.5,
  "memoria": 45.2,
  "discoLivrePercentual": 68.7,
  "servicos": [
    { "nome": "spooler", "status": "running" },
    { "nome": "wuauserv", "status": "stopped" },
    { "nome": "w32time", "status": "running" }
  ],
  "latenciaMs": 42
}
```

## JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["filialId", "timestamp", "cpu", "memoria", "discoLivrePercentual", "servicos"],
  "properties": {
    "filialId": { "type": "string", "minLength": 1, "maxLength": 64, "pattern": "^[a-z0-9-]+$" },
    "timestamp": { "type": "string", "format": "date-time" },
    "cpu": { "type": "number", "minimum": 0, "maximum": 100 },
    "memoria": { "type": "number", "minimum": 0, "maximum": 100 },
    "discoLivrePercentual": { "type": "number", "minimum": 0, "maximum": 100 },
    "servicos": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["nome", "status"],
        "properties": {
          "nome": { "type": "string", "minLength": 1 },
          "status": { "type": "string", "enum": ["running", "stopped", "paused", "unknown"] }
        }
      }
    },
    "latenciaMs": { "type": "number", "minimum": 0 }
  },
  "additionalProperties": false
}
```

## Códigos de resposta

| Código | Significado |
|--------|-------------|
| 200 | Batimento recebido e processado |
| 400 | Payload inválido (falha na validação do schema) |
| 401 | Token ausente, inválido ou filial inexistente |
| 429 | Rate limit excedido |
| 500 | Erro interno do servidor |

## Notas de implementação

- O agente deve tolerar falhas de rede e tentar reenviar no próximo ciclo (não bloquear a execução).
- O campo `timestamp` deve ser gerado no momento da coleta, não no envio.
- O agente roda em PowerShell 5.1 (Windows 10/11), sem dependências externas.
- A coleta de CPU/memória/disco deve reutilizar as funções puras do projeto `kit-suporte-powershell` (`Get-PercentualLivre`, `Get-ClassificacaoDisco`, `ConvertTo-TamanhoLegivel`).
- Serviços monitorados são configuráveis via `config.json` (ver `config.exemplo.json`).