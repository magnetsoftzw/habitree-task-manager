const clientId = (value) => (typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value) ? value : undefined);
const withClientId = (body) => (clientId(body?._id) ? { _id: body._id } : {});

module.exports = { clientId, withClientId };
