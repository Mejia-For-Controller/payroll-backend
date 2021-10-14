var randomstring = require("randomstring");

export function generateIdempotency() {
  return `${Date.now()}${randomstring.generate({
    length: 10,
    charset: 'alphanumeric',
    capitalization: 'lowercase'
  })}`;
}
