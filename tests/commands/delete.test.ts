import { vi, describe, it, beforeEach, expect } from 'vitest';
import { DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { DeleteItemCommand, DeleteResult } from 'src/commands/delete';
import { defineEntity } from 'src/entity';
import { defineTable } from 'src/table';

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
