/**
 * API Response Types
 */

export interface ApiResponse<T = unknown> {
	code: number;
	status: "success" | "failed";
	message: string;
	data: T;
}

export interface Pagination {
	total: number;
	current_page: number;
	total_page: number;
	size: number;
	has_next_page: boolean;
	has_prev_page: boolean;
}

export interface PaginatedData<T> {
	items: T[];
	pagination: Pagination;
}

export type PaginatedResponse<T> = ApiResponse<PaginatedData<T>>;

/**
 * Data Models
 */

export interface Post {
	_id: string;
	title: string;
	text: string;
	slug: string;
	categoryId: string;
	summary?: string;
	tags: string[];
	created: string;
	modified?: string;
	allowComment: boolean;
	isPublished: boolean;
	copyright: boolean;
	meta?: string;
	images: PostImage[];
}

export interface PostImage {
	src: string;
	height?: number;
	width?: number;
	type?: string;
}

export interface Note {
	_id: string;
	nid: number;
	title: string;
	text: string;
	created: string;
	modified?: string;
	mood?: string;
	weather?: string;
	location?: string;
	allowComment: boolean;
	isPublished: boolean;
	bookmark: boolean;
	images: NoteImage[];
}

export interface NoteImage {
	src: string;
	height?: number;
	width?: number;
	type?: string;
}

export interface Category {
	_id: string;
	name: string;
	slug: string;
	type: number;
	created: string;
}

export interface Link {
	_id: string;
	name: string;
	url: string;
	avatar: string;
	description: string;
	state: number;
	created: string;
	email?: string;
}

export interface Activity {
	_id: string;
	type: number;
	payload: string;
	created: string;
}

export interface Recently {
	_id: string;
	content: string;
	up: number;
	down: number;
	created: string;
	ref_id?: string;
	refType?: string;
}

export interface UserSocialIds {
	github?: string;
	bilibili?: string;
	netease?: string;
	twitter?: string;
	telegram?: string;
	mail?: string;
	rss?: string;
}

export interface User {
	_id: string;
	username: string;
	name: string;
	introduce: string;
	avatar: string;
	mail: string;
	url: string;
	created: string;
	last_login_time: string;
	social_ids?: UserSocialIds;
}

export interface Reader {
	_id: string;
	email: string;
	name: string;
	handle: string;
	image: string;
	is_owner: boolean;
	email_verified?: boolean;
	created_at: string;
	updated_at: string;
}
