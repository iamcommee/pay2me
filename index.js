const http = require('http')
const express = require('express')
const bodyParser = require('body-parser')
const {
    createMessageAdapter
} = require('@slack/interactive-messages')
const {
    WebClient
} = require('@slack/web-api')

const slackSigningSecret = process.env.SLACK_SIGNING_SECRET
const slackAccessToken = process.env.SLACK_ACCESS_TOKEN

// Create the adapter using the app's signing secret
const slackInteractions = createMessageAdapter(slackSigningSecret)

// Create a Slack Web API client using the access token
const web = new WebClient(slackAccessToken)

// Initialize an Express application
const app = express()
const port = process.env.PORT ?? '80'

if (!slackSigningSecret || !slackAccessToken) {
    throw new Error('A Slack signing secret and access token are required to run this app')
}

http.createServer(app).listen(port, () => {
    console.log(`Server listening on port ${port}`)
})

// Commands
async function slackSlashCommand(req, res, next) {

    console.log(req.body)

    if (req.body.command === '/qrcode') {


    } else {

        res.send('Please use / to see command list')

    }
}

async function generatePromptpayQRCode(promptpay, amount) {
    const promptpayQR = require('promptpay-qr')
    const qrcode = require('qrcode')

    const payload = promptpayQR(promptpay, {
        amount
    })

    const options = {
        type: 'svg',
        color: {
            dark: '#000',
            light: '#fff'
        }
    }

    return await new Promise((resolve, reject) => {
        qrcode.toString(payload, options, (err, svg) => {
            if (err) return reject(err)
            resolve(svg)
        })
    })
}

app.use('/slack/actions', slackInteractions.expressMiddleware())
app.post('/slack/commands', bodyParser.urlencoded({
    extended: false
}), slackSlashCommand)

app.get('/health', (req, res) => {
    return res.send({
        message: 'OK'
    })
})

app.get('/qrcode/:promptpay/:amonut', async (req, res) => {
    const qrCodeSVG = await generatePromptpayQRCode(req.params.promptpay, parseFloat(req.params.amonut))
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(qrCodeSVG)
});