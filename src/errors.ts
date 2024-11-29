export class LinkUpError extends Error {
	constructor(
		message: string,
		public statusCode?: number
	) {
		super(message);
		this.name = "LinkUpError";
	}
}
