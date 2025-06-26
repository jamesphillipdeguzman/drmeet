// user.service.js

import User from "../models/user.model.js";

// Get all users
export const findAllUsers = async () => User.find();

// Find a user by their ID
export const findUserById = async (id) => User.findById(id);

// Find a user by their email address
export const findUserByEmail = async (email) => User.findOne({ email });

// Create a new user
export const createUser = async (data) => User(data).save();

// Update an existing user by ID
export const updateUserById = async (id, updates) =>
  User.findByIdAndUpdate(id, updates, { new: true });

// Delete a user by ID
export const deleteUserById = async (id) => User.findByIdAndDelete(id);
