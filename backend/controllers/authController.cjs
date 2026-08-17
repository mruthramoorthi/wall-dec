const authModel = require('../models/authModel.cjs');

exports.sendOtp = async (req, res, next) => {
  try {
    const { email } = req.body;
    const result = await authModel.sendRegistrationOtp(email);
    res.json(result);
  } catch (err) { next(err); }
};

exports.verifyOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    const result = await authModel.verifyRegistrationOtp(email, otp);
    res.json(result);
  } catch (err) { next(err); }
};

exports.sendForgotPasswordOtp = async (req, res, next) => {
  try {
    const { identifier } = req.body;
    const result = await authModel.sendForgotPasswordOtp(identifier);
    res.json(result);
  } catch (err) { next(err); }
};

exports.verifyForgotPasswordOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    const result = await authModel.verifyForgotPasswordOtp(email, otp);
    res.json(result);
  } catch (err) { next(err); }
};

exports.resetPasswordWithOtp = async (req, res, next) => {
  try {
    const { email, otp, new_password } = req.body;
    const result = await authModel.resetPasswordWithOtp({ email, otp, new_password });
    res.json(result);
  } catch (err) { next(err); }
};

exports.checkUsername = async (req, res, next) => {
  try {
    const { username } = req.params;
    const { exclude_uid } = req.query;
    const available = await authModel.checkUsernameAvailable(username, exclude_uid);
    res.json({ available });
  } catch (err) { next(err); }
};

exports.register = async (req, res, next) => {
  try {
    let profile_picture = null;
    if (req.file) {
      profile_picture = req.file.filename;
    }
    const result = await authModel.register({ ...req.body, profile_picture });
    res.status(201).json({ message: 'User registered successfully! You can now log in.', data: result });
  } catch (err) { next(err); }
};

exports.login = async (req, res, next) => {
  try {
    const { identifier, password } = req.body;
    const result = await authModel.login(identifier, password);
    res.json({ message: 'Login successful!', data: result });
  } catch (err) { next(err); }
};

exports.getProfile = async (req, res, next) => {
  try {
    const { uid } = req.params;
    const profile = await authModel.getProfile(uid);
    res.json({ data: profile });
  } catch (err) { next(err); }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const { uid } = req.params;
    let profile_picture = undefined;
    if (req.file) {
      profile_picture = req.file.filename;
    }
    const profile = await authModel.updateProfile(uid, { ...req.body, profile_picture });
    res.json({ message: 'Profile updated successfully!', data: profile });
  } catch (err) { next(err); }
};

exports.changePassword = async (req, res, next) => {
  try {
    const { uid } = req.params;
    const result = await authModel.changePassword(uid, req.body);
    res.json(result);
  } catch (err) { next(err); }
};

exports.getPreferences = async (req, res, next) => {
  try {
    const { uid } = req.params;
    const prefs = await authModel.getPreferences(uid);
    res.json({ data: prefs });
  } catch (err) { next(err); }
};

exports.updatePreferences = async (req, res, next) => {
  try {
    const { uid } = req.params;
    const prefs = await authModel.updatePreferences(uid, req.body);
    res.json({ message: 'Preferences updated successfully!', data: prefs });
  } catch (err) { next(err); }
};
