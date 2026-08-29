import api from '../../services/api.js';

export function getMovementConfig(referenceType) {
  switch (referenceType) {
    case "PURCHASE":
      return { movementType: "INBOUND", operationType: "UNLOAD" };
    case "SALES":
      return { movementType: "OUTBOUND", operationType: "LOAD" };
    case "PURCHASE_RETURN":
      return { movementType: "OUTBOUND", operationType: "LOAD" };
    case "SALES_RETURN":
      return { movementType: "INBOUND", operationType: "UNLOAD" };
    default:
      return { movementType: "", operationType: "" };
  }
}

export async function getVehicleMovements() {
  return api('vehicle-movements');
}

export async function createVehicleMovement(data) {
  return api('vehicle-movements', { 
    method: 'POST', 
    body: data 
  });
}

export async function getVehicleMovement(id) {
  return api(`vehicle-movements/${id}`);
}

export async function updateVehicleMovement(id, data) {
  return api(`vehicle-movements/${id}`, { 
    method: 'PUT', 
    body: data 
  });
}

export async function deleteVehicleMovement(id) {
  return api(`vehicle-movements/${id}`, { 
    method: 'DELETE' 
  });
}

