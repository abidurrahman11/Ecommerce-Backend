const User = require('../../src/classes/User');

// unit tests for the User domain class, no db or http involved here.
describe('User class', () => {
  it('hashes a password and can verify it back', async () => {
    const hashed = await User.hashPassword('mypassword123');

    // the hash should never equal the plain password.
    expect(hashed).not.toBe('mypassword123');

    const user = new User({ id: 1, name: 'Jane', email: 'jane@test.com', password: hashed, role: 'user' });
    const isMatch = await user.comparePassword('mypassword123');
    expect(isMatch).toBe(true);
  });

  it('rejects the wrong password', async () => {
    const hashed = await User.hashPassword('correct-password');
    const user = new User({ id: 1, name: 'Jane', email: 'jane@test.com', password: hashed, role: 'user' });

    const isMatch = await user.comparePassword('wrong-password');
    expect(isMatch).toBe(false);
  });

  it('knows if a user is admin', () => {
    const admin = new User({ id: 1, name: 'Admin', email: 'admin@test.com', password: 'x', role: 'admin' });
    const user = new User({ id: 2, name: 'User', email: 'user@test.com', password: 'x', role: 'user' });

    expect(admin.isAdmin()).toBe(true);
    expect(user.isAdmin()).toBe(false);
  });

  it('never leaks the password hash in toJSON', () => {
    const user = new User({ id: 1, name: 'Jane', email: 'jane@test.com', password: 'secret-hash', role: 'user' });
    const json = user.toJSON();

    expect(json.password).toBeUndefined();
    expect(json).toEqual({ id: 1, name: 'Jane', email: 'jane@test.com', role: 'user' });
  });
});
