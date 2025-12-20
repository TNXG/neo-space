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
	category?: Category;
	summary?: string;
	/** AI 生成的摘要 */
	aiSummary?: string;
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
	aiSummary?: string;
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

/** 带预渲染内容的 Recently（用于首页） */
export interface RecentlyWithRendered extends Recently {
	renderedContent: React.ReactNode;
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
	socialIds?: UserSocialIds;
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

export interface Page {
	_id: string;
	title: string;
	text: string;
	slug: string;
	created: string;
	allowComment: boolean;
	commentsIndex: number;
}

/**
 * Time Capsule - 文章时效性分析
 */
export type TimeSensitivity = "high" | "medium" | "low";

export interface TimeCapsuleResponse {
	sensitivity: TimeSensitivity;
	reason: string;
	markers: string[];
	isNew: boolean;
}

export interface TimeCapsuleRequest {
	refId: string;
	refType?: "post" | "note" | "page";
}

/**
 * Site Configuration (from options collection)
 */

export interface SeoOptions {
	title: string;
	description: string;
	keywords: string[];
}

export interface UrlOptions {
	wsUrl?: string;
	adminUrl?: string;
	serverUrl?: string;
	webUrl?: string;
}

export interface FeatureListOptions {
	emailSubscribe: boolean;
}

export interface FriendLinkOptions {
	allowApply: boolean;
	allowSubPath: boolean;
}

export interface CommentOptionsPublic {
	disableComment: boolean;
	disableNoChinese: boolean;
}

export interface OAuthProvider {
	type: string;
	enabled: boolean;
}

export interface OAuthPublicOptions {
	providers: OAuthProvider[];
	github_client_id?: string;
}

export interface AlgoliaPublicOptions {
	enable: boolean;
	appId?: string;
	indexName?: string;
}

export interface AdminExtraPublic {
	title?: string;
	background?: string;
}

export interface SiteConfig {
	seo: SeoOptions;
	url: UrlOptions;
	features: FeatureListOptions;
	friend_link: FriendLinkOptions;
	comment: CommentOptionsPublic;
	oauth: OAuthPublicOptions;
	algolia: AlgoliaPublicOptions;
	admin_extra: AdminExtraPublic;
}

/**
 * Comment Types
 */

export interface Comment {
	_id: string;
	ref: string;
	refType: "posts" | "pages" | "notes";
	author: string;
	text: string;
	state: number;
	children: Comment[];
	commentsIndex: number;
	key: string;
	pin: boolean;
	isWhispers: boolean;
	isAdmin?: boolean;
	source?: string;
	avatar?: string;
	created: string;
	location?: string;
	url?: string;
	parent?: string;
}

export interface CommentListResponse {
	comments: Comment[];
	count: number;
}

export interface CreateCommentRequest {
	ref: string;
	refType: "posts" | "pages" | "notes";
	author: string;
	mail: string;
	text: string;
	url?: string;
	parent?: string;
}

export interface UpdateCommentRequest {
	text: string;
}
