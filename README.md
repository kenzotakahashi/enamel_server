# Enamel

This is a repository for my Wrike-clone app.

## Project Setup
1. Clone the project
2. Install the dependencies using yarn
    ```
    yarn
    ```
    or using npm
    ```
    npm i
    ```
3. Update JWT_SECRET, GMAIL_ACCOUNT and GMAIL_PASSWORD in .env
    ```
    JWT_SECRET=JWT_SECRET_GOES_HERE
    GMAIL_ACCOUNT=YOUR_GMAIL_ACCOUNT_GOES_HERE
    GMAIL_PASSWORD=YOUR_GMAIL_PASSWORD_GOES_HERE
    ```
4. Run mongoDB process
    ```
    mongod
    ```
5. Run the server using yarn
    ```
    yarn dev
    ```
    or using npm
    ```
    npm run dev
    ```