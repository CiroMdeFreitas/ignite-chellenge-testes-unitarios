import { hash } from "bcryptjs";
import { v4 as uuidV4 } from "uuid";
import { Connection } from "typeorm";
import createConnection from '../../../../database';
import { UsersRepository } from "../../../../modules/users/repositories/UsersRepository";
import { IUsersRepository } from "../../../../modules/users/repositories/IUsersRepository";
import { IStatementsRepository } from "../../../../modules/statements/repositories/IStatementsRepository";
import { CreateStatementUseCase } from "../../../../modules/statements/useCases/createStatement/CreateStatementUseCase";
import { StatementsRepository } from "../../../../modules/statements/repositories/StatementsRepository";
import { CreateStatementError } from "../../../../modules/statements/useCases/createStatement/CreateStatementError";
import { ICreateStatementDTO } from "../../../../modules/statements/useCases/createStatement/ICreateStatementDTO";

let createStatementUseCase: CreateStatementUseCase; 
let statementsRepository: IStatementsRepository; 
let usersRepository: IUsersRepository;
let connection: Connection;

enum OperationType {
  DEPOSIT = 'deposit',
  WITHDRAW = 'withdraw',
}

const userId = uuidV4();
const wrongUserId = uuidV4();

const depositStatement: ICreateStatementDTO = {
    user_id: userId,
    type: OperationType.DEPOSIT,
    amount: 100,
    description: "deposit description",
}

const withdrawStatement: ICreateStatementDTO = {
    user_id: userId,
    type: OperationType.WITHDRAW,
    amount: 100,
    description: "withdraw description",
}

const wrongoUserStatement: ICreateStatementDTO = {
    user_id: wrongUserId,
    type: OperationType.DEPOSIT,
    amount: 100,
    description: "deposit description",
}

describe("Create Statement Use Case", () => {
    beforeAll(async () => {
        connection = await createConnection();
        await connection.runMigrations();

        const userPassword = await hash("password", 8);
        await connection.query(
            `
                INSERT INTO USERS(id, name, email, password, created_at, updated_at) 
                values(
                    '${userId}',
                    'User',
                    'user@email.com',
                    '${userPassword}',
                    'now()',
                    'now()')
            `);
    });

    afterAll(async () => {
        await connection.dropDatabase();
        await connection.close();
    });
    
    beforeEach(async () => {
        usersRepository = new UsersRepository();
        statementsRepository = new StatementsRepository();
        createStatementUseCase = new CreateStatementUseCase(usersRepository, statementsRepository);
    });

    it("Should be able to make a deposit on user's account", async () => {
        const statement = await createStatementUseCase.execute(depositStatement);

        expect(statement).toHaveProperty("id");
        expect(statement.user_id).toBe(userId);
        expect(statement.type).toBe('deposit');
    });

    it("Should be able to make a withdraw from user's account", async () => {
        await createStatementUseCase.execute(depositStatement);

        const statement = await createStatementUseCase.execute({
            user_id: String(userId),
            type: 'withdraw' as OperationType,
            amount: 100,
            description: "description",
        });

        expect(statement).toHaveProperty("id");
        expect(statement.user_id).toBe(userId);
        expect(statement.type).toBe('withdraw');
    });

    it("Should not be able to do a statement if user is invalid", async () => {
        await expect(async () => {
            await createStatementUseCase.execute(wrongoUserStatement);
        }).rejects.toBeInstanceOf(CreateStatementError.UserNotFound);
    });

    it("Should not be able to make a withdraw from user's account if user's balance is insufficient", async () => {
        await expect(async () => {
            await createStatementUseCase.execute(withdrawStatement);
        }).rejects.toBeInstanceOf(CreateStatementError.InsufficientFunds);
    });
});