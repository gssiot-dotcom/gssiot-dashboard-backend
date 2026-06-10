# MQTT Gateway Commands

This document describes the two gateway MQTT commands currently exposed through HTTP endpoints:

- Alarm Level Set (`cmd: 4`)
- Fault Filter Set (`cmd: 5`)

Both commands publish an MQTT request to the gateway and wait up to 10 seconds for a gateway response. If no matching response arrives, the HTTP request fails with `504 MQTT response timeout`.

## Common MQTT Topics

| Direction | Topic |
| --- | --- |
| Website -> Gateway | `GSSIOT/01030369081/GATE_SUB/{gatewaySerialNum}` |
| Gateway -> Website | `GSSIOT/01030369081/GATE_RES/{gatewaySerialNum}` |

`gatewaySerialNum` is sent with the `GRM22JU22P` prefix. If the saved gateway serial number is only the last digits, the backend adds the prefix before publishing.

## Node Type Mapping

| UI / API alarmType | MQTT nodeType | Description |
| --- | ---: | --- |
| `angle_node` | `1` | Angle node |
| `gangform_node` | `2` | Vertical / form node |

## 1. Alarm Level Set

### HTTP Endpoints

| Role | Method | Endpoint |
| --- | --- | --- |
| Admin | `PATCH` | `/admin/buildings/:buildingId/alarm-level` |
| Manager | `PATCH` | `/manager/buildings/:buildingId/alarm-level` |

### HTTP Request Body

Set alarm levels for all assigned gateways in the building:

```json
{
  "alarmType": "angle_node",
  "green": 0.5,
  "yellow": 1.5,
  "red": 3.5
}
```

Set alarm levels for one gateway:

```json
{
  "gatewayId": "665f1a2b3c4d5e6f78901234",
  "alarmType": "gangform_node",
  "green": 0.5,
  "yellow": 1.5,
  "red": 3.5,
  "enabled": true
}
```

Disable alarm sending for one gateway:

```json
{
  "gatewayId": "665f1a2b3c4d5e6f78901234",
  "alarmType": "angle_node",
  "enabled": false
}
```

### MQTT Payload Sent To Gateway

Angle-node alarm set:

```json
{
  "cmd": 4,
  "nodeType": 1,
  "enabled": true,
  "alarmEnabled": true,
  "alarmLevel1": 0.5,
  "alarmLevel2": 1.5,
  "alarmLevel3": 3.5
}
```

Vertical/form-node alarm set:

```json
{
  "cmd": 4,
  "nodeType": 2,
  "enabled": true,
  "alarmEnabled": true,
  "alarmLevel1": 0.5,
  "alarmLevel2": 1.5,
  "alarmLevel3": 3.5
}
```

Angle-node alarm disable:

```json
{
  "cmd": 4,
  "nodeType": 1,
  "enabled": false,
  "alarmEnabled": false
}
```

Vertical/form-node alarm disable:

```json
{
  "cmd": 4,
  "nodeType": 2,
  "enabled": false,
  "alarmEnabled": false
}
```

### Expected MQTT Response

The backend matches responses by gateway number and `cmd: 4`.

Success can be returned in any of these forms:

```json
{
  "cmd": 4,
  "resp": "success"
}
```

```json
{
  "cmd": 4,
  "success": true
}
```

The backend also accepts `status: "success"`, `result: "success"`, or `ok: true`.

### HTTP Success Response Data

```json
{
  "alarmLevel": {
    "buildingId": "665f1a2b3c4d5e6f78901230",
    "alarmType": "angle_node",
    "green": 0.5,
    "yellow": 1.5,
    "red": 3.5
  },
  "gatewayResults": [
    {
      "gatewayId": "665f1a2b3c4d5e6f78901234",
      "gatewaySerialNum": "0201",
      "status": "success",
      "message": "success",
      "response": {
        "cmd": 4,
        "resp": "success"
      }
    }
  ],
  "summary": {
    "total": 1,
    "successCount": 1,
    "errorCount": 0,
    "timeoutCount": 0
  }
}
```

## 2. Fault Filter Set

### HTTP Endpoints

| Role | Method | Endpoint |
| --- | --- | --- |
| Admin | `PATCH` | `/admin/buildings/:buildingId/fault-filter` |
| Manager | `PATCH` | `/manager/buildings/:buildingId/fault-filter` |

### HTTP Request Body

Add one node to the gateway's missing-alarm node list:

```json
{
  "gatewayId": "665f1a2b3c4d5e6f78901234",
  "alarmType": "angle_node",
  "nodeNumber": 1,
  "enabled": true
}
```

Remove one node from the gateway's missing-alarm node list:

```json
{
  "gatewayId": "665f1a2b3c4d5e6f78901234",
  "alarmType": "gangform_node",
  "nodeNumber": 7,
  "enabled": false
}
```

Replace the gateway's full filter list with multiple nodes:

```json
{
  "gatewayId": "665f1a2b3c4d5e6f78901234",
  "alarmType": "angle_node",
  "nodes": [1, 2, 5]
}
```

Clear the gateway's filter list:

```json
{
  "gatewayId": "665f1a2b3c4d5e6f78901234",
  "alarmType": "gangform_node",
  "nodes": []
}
```

### MQTT Payload Sent To Gateway

Angle-node fault filter set:

```json
{
  "cmd": 5,
  "nodeType": 1,
  "numNodes": 1,
  "nodes": [1]
}
```

Vertical/form-node fault filter set:

```json
{
  "cmd": 5,
  "nodeType": 2,
  "numNodes": 1,
  "nodes": [7]
}
```

Angle-node multiple filter:

```json
{
  "cmd": 5,
  "nodeType": 1,
  "numNodes": 3,
  "nodes": [1, 2, 5]
}
```

Vertical/form-node multiple filter:

```json
{
  "cmd": 5,
  "nodeType": 2,
  "numNodes": 3,
  "nodes": [6, 7, 10]
}
```

Angle-node filter clear:

```json
{
  "cmd": 5,
  "nodeType": 1,
  "numNodes": 0,
  "nodes": []
}
```

Vertical/form-node filter clear:

```json
{
  "cmd": 5,
  "nodeType": 2,
  "numNodes": 0,
  "nodes": []
}
```

### Expected MQTT Response

The backend matches responses by gateway number and `cmd: 5`.

Success response:

```json
{
  "cmd": 5,
  "resp": "success",
  "nodeType": 1,
  "numNodes": 1,
  "nodes": [1]
}
```

The backend also accepts `status: "success"`, `result: "success"`, `success: true`, or `ok: true`.

### HTTP Success Response Data

```json
{
  "faultFilterNodes": [1],
  "gatewayResults": [
    {
      "gatewayId": "665f1a2b3c4d5e6f78901234",
      "gatewaySerialNum": "0201",
      "status": "success",
      "message": "success",
      "response": {
        "cmd": 5,
        "resp": "success",
        "nodeType": 1,
        "numNodes": 1,
        "nodes": [1]
      }
    }
  ],
  "summary": {
    "total": 1,
    "successCount": 1,
    "errorCount": 0,
    "timeoutCount": 0
  }
}
```

## Error Behavior

If every gateway command fails or times out, the HTTP endpoint returns an error.

Timeout:

```json
{
  "message": "MQTT response timeout"
}
```

Failure:

```json
{
  "message": "Failed setting alarm level on all gateways"
}
```

```json
{
  "message": "Failed setting fault filter on gateway"
}
```

For partial gateway failures in Alarm Level Set, successful gateways are saved and failed gateway results are returned in `gatewayResults` and `summary`.
