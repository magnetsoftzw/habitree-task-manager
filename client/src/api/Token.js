const KEY = 'habitree_token';

export const getToken = () => localStorage.getItem(KEY) || sessionStorage.getItem(KEY);

export const setToken = (token, remember = true) => {
    localStorage.removeItem(KEY);
    sessionStorage.removeItem(KEY);
    (remember ? localStorage : sessionStorage).setItem(KEY, token);
};

export const clearToken = () => {
    localStorage.removeItem(KEY);
    sessionStorage.removeItem(KEY);
};
