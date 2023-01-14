import { vi, describe, it, beforeEach, expect } from 'vitest';
import { DeleteCommand, GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { DeleteItemCommand, GetItemCommand, PutItemCommand, QueryItemsCommand, UpdateItemCommand } from 'src/commands';
import { DeleteResult, GetResult, PutResult, QueryResult, UpdateResult } from '../src/results';
import { defineEntity } from 'src/entity';
import { defineTable, TableConfig } from 'src/table';

type Test = {
	id: string;
	name: string;
	orgId: string;
	smth?: string;
	email?: string;
	pk?: string;
	sk?: string;
};

const TestEntity = defineEntity<Test>({
	name: 'TEST',
	computed: {
		pk: {
			dependsOn: ['id'],
			get: (item) => `TEST#${item.id}`,
		},
		sk: {
			dependsOn: ['email'],
			get: (item) => (item.email ? `EMAIL#${item.email}` : undefined),
		},
	},
});

describe('GetItemCommand', () => {
	let cmd: GetItemCommand;

	const created = new Date();
	const updated = new Date();

	let dbClient = {
		send: vi.fn(),
	}; // just for testing

	const table = defineTable(dbClient as any, {
		name: 'TestTable',
		primaryKey: 'pk',
		sortKey: 'sk',
		indexes: {
			ByEmail: {
				primaryKey: 'orgId',
				sortKey: 'email',
			},
		},
		entities: [TestEntity],
	});

	beforeEach(() => {
		dbClient.send.mockResolvedValue({
			Item: {
				id: '12345',
				name: 'Damian',
				orgId: 'ACME',
				email: 'damian@acme.com',
				smth: 'something',
				_created: created.toISOString(),
				_updated: updated.toISOString(),
				_type: 'TEST',
				pk: 'TEST#12345',
				sk: 'EMAIL#damian@acme.com',
			},
		});
		dbClient.send.mockClear();

		cmd = new GetItemCommand(
			dbClient as never,
			{
				TableName: 'TestTable',
				Key: {
					pk: 'pk-value',
					sk: 'sk-value',
				},
			},
			table,
		);
	});

	it('Should return instance of GetItemCommand on creation', () => {
		expect(cmd).toBeInstanceOf(GetItemCommand);
	});

	it('Should send GetCommand to the dbClient', async () => {
		await cmd.send();
		expect(dbClient.send).toHaveBeenCalledTimes(1);
		expect(dbClient.send.mock.lastCall![0]).toBeInstanceOf(GetCommand);
	});

	it('Should create GetCommand with a proper input', async () => {
		await cmd.send();
		const getCmd = dbClient.send.mock.lastCall![0];

		expect(getCmd.input).toEqual({
			TableName: 'TestTable',
			Key: {
				pk: 'pk-value',
				sk: 'sk-value',
			},
		});
	});

	it('Should send command and return GetResult', async () => {
		const res = await cmd.send();
		expect(res).toBeInstanceOf(GetResult);
	});

	it('The result should return instance of the matching item', async () => {
		const res = await cmd.send();
		expect(res.item<Test>()).toEqual({
			id: '12345',
			name: 'Damian',
			orgId: 'ACME',
			email: 'damian@acme.com',
			smth: 'something',
			_created: created,
			_updated: updated,
			_type: 'TEST',
			pk: 'TEST#12345',
			sk: 'EMAIL#damian@acme.com',
		});
	});

	it('Returned instance should have functioning computed properties', async () => {
		const res = await cmd.send();
		const record = res.item<Test>()!;

		expect(record.pk).toBe('TEST#12345');

		record.id = '0987';
		expect(record.pk).toBe('TEST#0987');
	});

	it('Should return null if no record found', async () => {
		dbClient.send.mockResolvedValue({ Item: undefined });

		const res = await cmd.send();
		expect(res.item<Test>()).toBe(null);
	});

	it('Should throw if Item is missing _type attribute', async () => {
		dbClient.send.mockResolvedValue({
			Item: {
				id: '12345',
				name: 'Damian',
				orgId: 'ACME',
				email: 'damian@acme.com',
			},
		});

		const res = await cmd.send();

		expect(() => {
			res.item<Test>();
		}).toThrowError();
	});

	it('The result should return raw data object from the output', async () => {
		const res = await cmd.send();
		expect(res.raw()).toEqual({
			id: '12345',
			name: 'Damian',
			orgId: 'ACME',
			email: 'damian@acme.com',
			smth: 'something',
			_created: created.toISOString(),
			_updated: updated.toISOString(),
			_type: 'TEST',
			pk: 'TEST#12345',
			sk: 'EMAIL#damian@acme.com',
		});
	});
});

describe('PutItemCommand', () => {
	let cmd: PutItemCommand;

	const created = new Date();
	const updated = new Date();

	const item = {
		id: '12345',
		name: 'Damian',
		orgId: 'ACME',
		email: 'damian@acme.com',
		smth: 'something',
		_created: created.toISOString(),
		_updated: updated.toISOString(),
		_type: 'TEST',
		pk: 'TEST#12345',
		sk: 'EMAIL#damian@acme.com',
	};

	let dbClient = {
		send: vi.fn(),
	}; // just for testing

	const table = defineTable(dbClient as any, {
		name: 'TestTable',
		primaryKey: 'pk',
		sortKey: 'sk',
		indexes: {
			ByEmail: {
				primaryKey: 'orgId',
				sortKey: 'email',
			},
		},
		entities: [TestEntity],
	});

	beforeEach(() => {
		dbClient.send.mockResolvedValue({
			Attributes: item,
		});
		dbClient.send.mockClear();

		cmd = new PutItemCommand(
			dbClient as never,
			{
				TableName: 'TestTable',
				Item: item,
			},
			table,
		);
	});

	it('Should return instance of PutItemCommand on creation', () => {
		expect(cmd).toBeInstanceOf(PutItemCommand);
	});

	it('Should send PutCommand to the dbClient', async () => {
		await cmd.send();
		expect(dbClient.send).toHaveBeenCalledTimes(1);
		expect(dbClient.send.mock.lastCall![0]).toBeInstanceOf(PutCommand);
	});

	it('Should create PutCommand with a proper input', async () => {
		await cmd.send();
		const getCmd = dbClient.send.mock.lastCall![0];

		expect(getCmd.input).toEqual({
			TableName: 'TestTable',
			Item: item,
		});
	});

	it('Should send command and return PutResult', async () => {
		const res = await cmd.send();
		expect(res).toBeInstanceOf(PutResult);
	});

	it('The result should return instance of the matching item', async () => {
		const res = await cmd.send();
		expect(res.item<Test>()).toEqual({
			id: '12345',
			name: 'Damian',
			orgId: 'ACME',
			email: 'damian@acme.com',
			smth: 'something',
			_created: created,
			_updated: updated,
			_type: 'TEST',
			pk: 'TEST#12345',
			sk: 'EMAIL#damian@acme.com',
		});
	});

	it('Returned instance should have functioning computed properties', async () => {
		const res = await cmd.send();
		const record = res.item<Test>()!;

		expect(record.pk).toBe('TEST#12345');

		record.id = '0987';
		expect(record.pk).toBe('TEST#0987');
	});

	it('Should return null if no record found', async () => {
		dbClient.send.mockResolvedValue({ Item: undefined });

		const res = await cmd.send();
		expect(res.item<Test>()).toBe(null);
	});

	it('Should throw if Item is missing _type attribute', async () => {
		dbClient.send.mockResolvedValue({
			Attributes: {
				id: '12345',
				name: 'Damian',
				orgId: 'ACME',
				email: 'damian@acme.com',
			},
		});

		const res = await cmd.send();

		expect(() => {
			res.item<Test>();
		}).toThrowError();
	});

	it('The result should return raw data object from the output', async () => {
		const res = await cmd.send();
		expect(res.raw()).toEqual({
			id: '12345',
			name: 'Damian',
			orgId: 'ACME',
			email: 'damian@acme.com',
			smth: 'something',
			_created: created.toISOString(),
			_updated: updated.toISOString(),
			_type: 'TEST',
			pk: 'TEST#12345',
			sk: 'EMAIL#damian@acme.com',
		});
	});
});

describe('DeleteItem Command', () => {
	let cmd: DeleteItemCommand;

	const created = new Date();
	const updated = new Date();

	const item = {
		id: '12345',
		name: 'Damian',
		orgId: 'ACME',
		email: 'damian@acme.com',
		smth: 'something',
		_created: created.toISOString(),
		_updated: updated.toISOString(),
		_type: 'TEST',
		pk: 'TEST#12345',
		sk: 'EMAIL#damian@acme.com',
	};

	let dbClient = {
		send: vi.fn(),
	}; // just for testing

	const table = defineTable(dbClient as any, {
		name: 'TestTable',
		primaryKey: 'pk',
		sortKey: 'sk',
		indexes: {
			ByEmail: {
				primaryKey: 'orgId',
				sortKey: 'email',
			},
		},
		entities: [TestEntity],
	});

	beforeEach(() => {
		dbClient.send.mockResolvedValue({
			Attributes: item,
		});
		dbClient.send.mockClear();

		cmd = new DeleteItemCommand(
			dbClient as never,
			{
				TableName: 'TestTable',
				Key: {
					pk: 'pk-value',
					sk: 'sk-value',
				},
				ReturnValues: 'ALL_OLD',
			},
			table,
		);
	});

	it('Should return instance of DeleteItemCommand on creation', () => {
		expect(cmd).toBeInstanceOf(DeleteItemCommand);
	});

	it('Should send DeleteCommand to the dbClient', async () => {
		await cmd.send();
		expect(dbClient.send).toHaveBeenCalledTimes(1);
		expect(dbClient.send.mock.lastCall![0]).toBeInstanceOf(DeleteCommand);
	});

	it('Should create DeleteCommand with a proper input', async () => {
		await cmd.send();
		const getCmd = dbClient.send.mock.lastCall![0];

		expect(getCmd.input).toEqual({
			TableName: 'TestTable',
			Key: {
				pk: 'pk-value',
				sk: 'sk-value',
			},
			ReturnValues: 'ALL_OLD',
		});
	});

	it('Should send command and return DeleteResult', async () => {
		const res = await cmd.send();
		expect(res).toBeInstanceOf(DeleteResult);
	});

	it('The result should return instance of the matching item', async () => {
		const res = await cmd.send();
		expect(res.item<Test>()).toEqual({
			id: '12345',
			name: 'Damian',
			orgId: 'ACME',
			email: 'damian@acme.com',
			smth: 'something',
			_created: created,
			_updated: updated,
			_type: 'TEST',
			pk: 'TEST#12345',
			sk: 'EMAIL#damian@acme.com',
		});
	});

	it('Returned instance should have functioning computed properties', async () => {
		const res = await cmd.send();
		const record = res.item<Test>()!;

		expect(record.pk).toBe('TEST#12345');

		record.id = '0987';
		expect(record.pk).toBe('TEST#0987');
	});

	it('Should return null if no record found', async () => {
		dbClient.send.mockResolvedValue({ Item: undefined });

		const res = await cmd.send();
		expect(res.item<Test>()).toBe(null);
	});

	it('Should throw if Item is missing _type attribute', async () => {
		dbClient.send.mockResolvedValue({
			Attributes: {
				id: '12345',
				name: 'Damian',
				orgId: 'ACME',
				email: 'damian@acme.com',
			},
		});

		const res = await cmd.send();

		expect(() => {
			res.item<Test>();
		}).toThrowError();
	});

	it('The result should return raw data object from the output', async () => {
		const res = await cmd.send();
		expect(res.raw()).toEqual({
			id: '12345',
			name: 'Damian',
			orgId: 'ACME',
			email: 'damian@acme.com',
			smth: 'something',
			_created: created.toISOString(),
			_updated: updated.toISOString(),
			_type: 'TEST',
			pk: 'TEST#12345',
			sk: 'EMAIL#damian@acme.com',
		});
	});
});

describe('UpdateItem Command', () => {
	let cmd: UpdateItemCommand;

	const created = new Date();
	const updated = new Date();

	const item = {
		id: '12345',
		name: 'Gucio',
		orgId: 'ACME',
		email: 'damian@acme.com',
		smth: 'something',
		_created: created.toISOString(),
		_updated: updated.toISOString(),
		_type: 'TEST',
		pk: 'TEST#12345',
		sk: 'EMAIL#damian@acme.com',
	};

	const input = {
		TableName: 'TestTable',
		Key: {
			pk: 'pk-value',
			sk: 'sk-value',
		},
		ReturnValues: 'ALL_NEW',
		UpdateExpression: 'SET #name = :name',
		ExpressionAttributeNames: { '#name': 'name' },
		ExpressionAttributeValues: { ':name': 'Gucio' },
	};

	let dbClient = {
		send: vi.fn(),
	}; // just for testing

	const table = defineTable(dbClient as any, {
		name: 'TestTable',
		primaryKey: 'pk',
		sortKey: 'sk',
		indexes: {
			ByEmail: {
				primaryKey: 'orgId',
				sortKey: 'email',
			},
		},
		entities: [TestEntity],
	});

	beforeEach(() => {
		dbClient.send.mockReturnValue({
			Attributes: item,
		});
		dbClient.send.mockClear();

		cmd = new UpdateItemCommand(dbClient as never, input, table);
	});

	it('Should return instance of UpdateItemCommand on creation', () => {
		expect(cmd).toBeInstanceOf(UpdateItemCommand);
	});

	it('Should send UpdateCommand to the dbClient', async () => {
		await cmd.send();
		expect(dbClient.send).toHaveBeenCalledTimes(1);
		expect(dbClient.send.mock.lastCall![0]).toBeInstanceOf(UpdateCommand);
	});

	it('Should create UpdateCommand with a proper input', async () => {
		await cmd.send();
		const getCmd = dbClient.send.mock.lastCall![0];

		expect(getCmd.input).toEqual(input);
	});

	it('Should send command and return UpdateResult', async () => {
		const res = await cmd.send();
		expect(res).toBeInstanceOf(UpdateResult);
	});

	it('The result should return instance of the matching item', async () => {
		const res = await cmd.send();
		expect(res.item<Test>()).toEqual({
			id: '12345',
			name: 'Gucio',
			orgId: 'ACME',
			email: 'damian@acme.com',
			smth: 'something',
			_created: created,
			_updated: updated,
			_type: 'TEST',
			pk: 'TEST#12345',
			sk: 'EMAIL#damian@acme.com',
		});
	});

	it('Returned instance should have functioning computed properties', async () => {
		const res = await cmd.send();
		const record = res.item<Test>()!;

		expect(record.pk).toBe('TEST#12345');

		record.id = '0987';
		expect(record.pk).toBe('TEST#0987');
	});

	it('Should return null if no record found', async () => {
		dbClient.send.mockResolvedValue({ Item: undefined });

		const res = await cmd.send();
		expect(res.item<Test>()).toBe(null);
	});

	it('Should throw if Item is missing _type attribute', async () => {
		dbClient.send.mockResolvedValue({
			Attributes: {
				id: '12345',
				name: 'Gucio',
				orgId: 'ACME',
				email: 'damian@acme.com',
			},
		});

		const res = await cmd.send();

		expect(() => {
			res.item<Test>();
		}).toThrowError();
	});

	it('The result should return raw data object from the output', async () => {
		const res = await cmd.send();
		expect(res.raw()).toEqual({
			id: '12345',
			name: 'Gucio',
			orgId: 'ACME',
			email: 'damian@acme.com',
			smth: 'something',
			_created: created.toISOString(),
			_updated: updated.toISOString(),
			_type: 'TEST',
			pk: 'TEST#12345',
			sk: 'EMAIL#damian@acme.com',
		});
	});
});

describe('QueryItems Command', () => {
	let cmd: QueryItemsCommand;

	const created = new Date();
	const updated = new Date();

	const items = [
		{
			id: '12345',
			name: 'Gucio',
			orgId: 'ACME',
			email: 'damian@acme.com',
			smth: 'something',
			_created: created.toISOString(),
			_updated: updated.toISOString(),
			_type: 'TEST',
			pk: 'TEST#12345',
			sk: 'EMAIL#damian@acme.com',
		},
		{
			id: '67890',
			name: 'Gucio',
			orgId: 'ACME',
			email: 'gucio@acme.com',
			smth: 'something',
			_created: created.toISOString(),
			_updated: updated.toISOString(),
			_type: 'TEST',
			pk: 'TEST#67890',
			sk: 'EMAIL#gucio@acme.com',
		},
	];

	const input = {
		TableName: 'TestTable',
		KeyConditionExpression: '#pk = :pk',
		ExpressionAttributeNames: { '#pk': 'pk' },
		ExpressionAttributeValues: { ':pk': 'pk-value' },
	};

	let dbClient = {
		send: vi.fn(),
	}; // just for testing

	const table = defineTable(dbClient as any, {
		name: 'TestTable',
		primaryKey: 'pk',
		sortKey: 'sk',
		indexes: {
			ByEmail: {
				primaryKey: 'orgId',
				sortKey: 'email',
			},
		},
		entities: [TestEntity],
	});

	beforeEach(() => {
		dbClient.send.mockResolvedValue({
			Items: items,
		});
		dbClient.send.mockClear();

		cmd = new QueryItemsCommand(dbClient as never, input, table);
	});

	it('Should return instance of QueryItemsCommand on creation', () => {
		expect(cmd).toBeInstanceOf(QueryItemsCommand);
	});

	it('Should send QueryCommand to the dbClient', async () => {
		await cmd.send();
		expect(dbClient.send).toHaveBeenCalledTimes(1);
		expect(dbClient.send.mock.lastCall![0]).toBeInstanceOf(QueryCommand);
	});

	it('Should create QueryCommand with a proper input', async () => {
		await cmd.send();
		const getCmd = dbClient.send.mock.lastCall![0];

		expect(getCmd.input).toEqual(input);
	});

	it('Should send command and return QueryResult', async () => {
		const res = await cmd.send();
		expect(res).toBeInstanceOf(QueryResult);
	});

	it('The result should return instance of the matching item', async () => {
		const res = await cmd.send();
		expect(res.items<Test>()).toEqual([
			{
				id: '12345',
				name: 'Gucio',
				orgId: 'ACME',
				email: 'damian@acme.com',
				smth: 'something',
				_created: created,
				_updated: updated,
				_type: 'TEST',
				pk: 'TEST#12345',
				sk: 'EMAIL#damian@acme.com',
			},
			{
				id: '67890',
				name: 'Gucio',
				orgId: 'ACME',
				email: 'gucio@acme.com',
				smth: 'something',
				_created: created,
				_updated: updated,
				_type: 'TEST',
				pk: 'TEST#67890',
				sk: 'EMAIL#gucio@acme.com',
			},
		]);
	});

	it('Returned instance should have functioning computed properties', async () => {
		const res = await cmd.send();
		const records = res.items<Test>()!;

		expect(records[0].pk).toBe('TEST#12345');

		records[0].id = '0987';
		expect(records[0].pk).toBe('TEST#0987');
	});

	it('Should return null if no record found', async () => {
		dbClient.send.mockResolvedValue({ Items: undefined });

		const res = await cmd.send();
		expect(res.items<Test>()).toEqual([]);
	});

	it('Should throw if Item is missing _type attribute', async () => {
		dbClient.send.mockResolvedValue({
			Items: [
				{
					id: '12345',
					name: 'Gucio',
					orgId: 'ACME',
					email: 'damian@acme.com',
				},
			],
		});

		const res = await cmd.send();

		expect(() => {
			res.items<Test>();
		}).toThrowError();
	});

	it('The result should return raw data object from the output', async () => {
		const res = await cmd.send();
		expect(res.raw()).toEqual(items);
	});
});
