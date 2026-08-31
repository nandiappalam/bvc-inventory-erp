async function reserveStock({ lotNo, quantity = 0 }) {
  return { lotNo, reserved: Number(quantity || 0) };
}

async function releaseStock({ lotNo, quantity = 0 }) {
  return { lotNo, released: Number(quantity || 0) };
}

async function consumeStock({ lotNo, quantity = 0 }) {
  return { lotNo, consumed: Number(quantity || 0) };
}

module.exports = {
  reserveStock,
  releaseStock,
  consumeStock,
};
