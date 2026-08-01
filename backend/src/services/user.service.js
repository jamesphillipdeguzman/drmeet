// user.service.js

import User from "../models/user.model.js";

// Get all users (non-deleted)
export const findAllUsers = async () => User.find({ is_deleted: { $ne: true } });

// Find a user by their ID (non-deleted)
export const findUserById = async (id) => User.findOne({ _id: id, is_deleted: { $ne: true } });

// Find a user by their email address (non-deleted)
export const findUserByEmail = async (email) => User.findOne({ email, is_deleted: { $ne: true } });

// Create a new user
export const createUser = async (data) => User(data).save();

// Update an existing user by ID
export const updateUserById = async (id, updates) =>
  User.findByIdAndUpdate(id, updates, { new: true });

// Delete a user by ID (Soft delete: set is_deleted flag to true)
export const deleteUserById = async (id) => User.findByIdAndUpdate(id, { is_deleted: true }, { new: true });
