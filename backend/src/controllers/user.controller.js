import mongoose from 'mongoose';

import {
    findAllUsers,
    findUserById,
    createUser as createUserService,
    updateUserById as updateUserByIdService,
    deleteUserById as deleteUserByIdService,
} from '../services/user.service.js';
import { syncRoleProfilesForUser } from '../services/userRoleProfileSync.service.js';
import { findDoctorByUserId } from '../services/doctor.service.js';
import { sanitizeInput } from '../utils/inputSanitizer.js';

function csvEscape(val) {
    const s = String(val ?? '');
    if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
}

/**
 * @route GET /api/users/export/csv
 * @desc Admin-only CSV export (same ?q and ?role filters as GET /api/users).
 */
export const exportUsersCsv = async (req, res) => {
    try {
        const role = String(req.user?.role || '').toLowerCase();
        if (role !== 'admin') {
            return res.status(403).json({ error: 'Forbidden.' });
        }
        let users = await findAllUsers();
        const q = String(req.query.q || '').trim().toLowerCase();
        const roleFilter = String(req.query.role || '').trim().toLowerCase();
        if (roleFilter) {
            users = users.filter((u) => String(u.role || '').toLowerCase() === roleFilter);
        }
        if (q) {
            users = users.filter((u) => {
                const hay = `${u.firstName || ''} ${u.lastName || ''} ${u.email || ''} ${u.phone || ''}`.toLowerCase();
                return hay.includes(q);
            });
        }
        const headers = ['_id', 'email', 'firstName', 'lastName', 'role', 'phone', 'createdAt'];
        const lines = [headers.join(',')];
        for (const u of users) {
            const plain = u?.toObject ? u.toObject() : u;
            lines.push(headers.map((h) => csvEscape(plain[h] ?? '')).join(','));
        }
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="users-export.csv"');
        return res.status(200).send(lines.join('\n'));
    } catch (error) {
        console.error('exportUsersCsv', error);
        return res.status(500).json({ error: 'Failed to export users.' });
    }
};

/**
 * @route GET /api/users
 * @desc Fetch all users
 */
export const getAllUsers = async (req, res) => {
    try {
        const role = String(req.user?.role || '').toLowerCase();
        const requesterId = String(req.user?._id || req.user?.id || '');
        let users = await findAllUsers();
        if (role === 'doctor' && requesterId) {
            const doctor = await findDoctorByUserId(requesterId);
            if (!doctor) {
                users = users.filter((u) => String(u._id) === requesterId);
            } else {
                const doctorId = String(doctor._id);
                users = users.filter(
                    (u) =>
                        String(u._id) === requesterId ||
                        (String(u.role || '').toLowerCase() === 'receptionist' &&
                            String(u.linkedDoctorId || '') === doctorId),
                );
            }
        }

        const q = String(req.query.q || '').trim().toLowerCase();
        const roleFilter = String(req.query.role || '').trim().toLowerCase();
        if (roleFilter) {
            users = users.filter((u) => String(u.role || '').toLowerCase() === roleFilter);
        }
        if (q) {
            users = users.filter((u) => {
                const hay = `${u.firstName || ''} ${u.lastName || ''} ${u.email || ''} ${u.phone || ''}`.toLowerCase();
                return hay.includes(q);
            });
        }

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
        const requesterRole = String(req.user?.role || '').toLowerCase();
        const requesterId = String(req.user?._id || req.user?.id || '');
        if (requesterRole === 'doctor') {
            const doctor = await findDoctorByUserId(requesterId);
            const doctorId = doctor ? String(doctor._id) : '';
            const isSelf = String(user._id) === requesterId;
            const isLinkedReceptionist =
                String(user.role || '').toLowerCase() === 'receptionist' &&
                doctorId &&
                String(user.linkedDoctorId || '') === doctorId;
            if (!isSelf && !isLinkedReceptionist) {
                return res.status(403).json({ error: 'Forbidden.' });
            }
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
        const userData = sanitizeInput(req.body || {});
        const newUser = await createUserService(userData);
        await syncRoleProfilesForUser(newUser, {
            title: req.body?.title,
            specialty: req.body?.specialty,
        });
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
    const updates = sanitizeInput(req.body || {});
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid user ID format.' });
    }

    try {
        const updatedUser = await updateUserByIdService(id, updates);
        if (!updatedUser) {
            return res.status(404).json({ error: 'User not found. ' });
        }
        await syncRoleProfilesForUser(updatedUser, {
            title: updates?.title,
            specialty: updates?.specialty,
        });
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
