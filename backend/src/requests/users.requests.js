import axios from 'axios';

const API_URL = '/api/users';

export const fetchAllUsers = () => axios.get(API_URL);
export const fetchUserById = (id) => axios.get(`${API_URL}/${id}`);
export const createUser = (data) => axios.post(API_URL, data);
export const updateUser = (id, data) => axios.put(`${API_URL}/${id}`, data);
export const deleteUser = (id) => axios.delete(`${API_URL}/${id}`);
