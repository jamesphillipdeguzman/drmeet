import mongoose from 'mongoose';

import {
    findAllUsers,
    findUserById,
    createUser as createUserService,
    updateUserById as updateUserByIdService,
    deleteUserById as deleteUserByIdService,
} from '../services/user.service.js';
/**
 * @route GET /api/users
 * @desc Fetch all users
 */
export const getAllUsers = async (req, res) => {
    try {
        const users = await findAllUsers();
        console.log('[USER]✅ GET /api/users was called.');
        return res.status(200).json(users);
    } catch (error) {
        console.log('Error fetching users: ', error);
        return res
            .status(500)
            .json({ error: 'An error occured while fetching all users.' });
    }
};

/**
 * @route GET /api/users/:id
 * @desc Fetch a user by ID
 */
export const getUserById = async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        console.log('Invalid user ID format');
        return res.status(400).json({ error: 'Invalid user ID format' });
    }
    try {
        const user = await findUserById(id);
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }
        console.log(`[USER]✅ GET /api/users/${id} was called`);
        return res.status(200).json(user);
    } catch (error) {
        console.log(`Error fetching the user with ${id}:`, error);
        return res
            .status(500)
            .json({ error: 'An error occured while fetching the user.' });
    }
};

/**
 * @route POST /api/users
 * @desc Create a new user
 */
export const postUser = async (req, res) => {
    try {
        const userData = req.body;
        const newUser = await createUserService(userData);
        if (!newUser) {
            return res.status(400).json({ error: 'Failed to create user.' });
        }
        console.log(
            `[USER]✅ POST /api/users - User ${newUser._id} created`,
        );
        return res.status(201).json(newUser);
    } catch (error) {
        console.error('Error creating the user: ', error);
        return res.status(500).json({
            error: error.message || 'An error occured while creating the user.',
        });
    }
};

/**
 * @route PUT /api/users/:id
 * @desc Update a user by ID
 */
export const updateUser = async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid user ID format.' });
    }

    try {
        const updatedUser = await updateUserByIdService(id, updates);
        if (!updatedUser) {
            return res.status(404).json({ error: 'User not found. ' });
        }
        console.log(`[USER]✅ PUT /api/users/${id} was called`);

        return res.status(200).json(updatedUser);
    } catch (error) {
        console.log(`Error updating the user with ${id}:`, error);
        return res
            .status(500)
            .json({ error: 'An error occured while updating the user.' });
    }
};

/**
 * @route DELETE /api/users/:id
 * @desc Delete a user by ID
 */
export const deleteUser = async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid user ID format.' });
    }
    try {
        const deletedUser = await deleteUserByIdService(id);
        if (!deletedUser) {
            return res.status(404).json({ error: 'User not found.' });
        }
        console.log(
            `[USER]✅ DELETE /api/users/${id} - User ${deletedUser._id} successfully deleted`,
        );

        return res.status(200).json({ message: `User ${id} deleted.` });
    } catch (error) {
        return res
            .status(500)
            .json({ error: 'An error occured while deleting the user.' });
    }
};
