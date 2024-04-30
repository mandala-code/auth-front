import { AUTH_API } from '$env/static/private';
import { access, code, setAccess } from '$lib/store';
import type { Cookies } from '@sveltejs/kit';
import { apiFetch } from './util/fetch';
import { setRefresh } from '$lib/cookie';
import type { replyData } from './interfaces/reply.interface';

export const token = {
	issue: async (cookies: Cookies): Promise<{ result: boolean; response: Response | null }> => {
		let currentCode: string | null = null;
		code.subscribe((value) => (currentCode = value));

		if (!currentCode) {
			return { result: false, response: null };
		}
		const url = AUTH_API + `/token/issue?code=${currentCode}`;
		const response = await apiFetch(url, {
			method: 'GET',
			credentials: 'same-origin'
		});

    code.set(null);

		if (response.status === 200) {
			const setAccessResult = setAccess(response);
			const setRefreshResult = setRefresh(cookies, response);
			if (!setAccessResult || !setRefreshResult) {
				return { result: false, response: response };
			}
			return { result: true, response: response };
		}
		return { result: false, response: response };
	},
	refresh: async (cookies: Cookies): Promise<{ result: boolean; response: Response | null }> => {
		const url = AUTH_API + `/token/refresh`;
		let accessToken: string | null = null;
		access.subscribe((value) => (accessToken = value));

		if (!accessToken) {
			return { result: false, response: null };
		}

		const response = await apiFetch(url, {
			method: 'GET',
			headers: {
				Authorization: `Bearer ${accessToken}`
			},
			credentials: 'same-origin'
		});

		if (response.status === 200) {
			const setAccessResult = setAccess(response);
			const setRefreshResult = setRefresh(cookies, response);
			if (!setAccessResult || !setRefreshResult) {
				return { result: false, response: response };
			}
			return { result: true, response: response };
		}
		return { result: false, response: response };
	},
	validate: async (
		response: Response,
		cookies: Cookies
	): Promise<{ result: boolean; refreshResponse: Response | null }> => {
		if (response.status === 200) return { result: true, refreshResponse: null};
    const replyData = await response.json() as replyData;
    const message = replyData.message;
		if (response.status === 401 && message !== 'Access token needs to be refreshed') {
			const refreshResult = await token.refresh(cookies);
      if (!refreshResult.response) {
        return { result: false, refreshResponse: null};
      }
			if (refreshResult.result) {
        return { result: true, refreshResponse: refreshResult.response };
			} else {
				return { result: false, refreshResponse: refreshResult.response};
			}
		}
		return { result: false, refreshResponse: null};
	}
};
