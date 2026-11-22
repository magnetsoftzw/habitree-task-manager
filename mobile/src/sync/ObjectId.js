let counter = Math.floor(Math.random() * 0xffffff);
const hex = (n, len) => n.toString(16).padStart(len, '0').slice(-len);
const machine = Array.from({ length: 5 }, () => hex(Math.floor(Math.random() * 256), 2)).join('');

export const objectId = () => {
  counter = (counter + 1) % 0xffffff;
  return hex(Math.floor(Date.now() / 1000), 8) + machine + hex(counter, 6);
};

export const opId = () => `${objectId()}-${hex(Math.floor(Math.random() * 0xffffffff), 8)}`;
