package truco

import "github.com/bonisoft3/pronto/identity"

// Google signs a person in through the operator's broker, which holds the one
// client every app on it shares: the app registers none of its own. A release
// turns it on.
identity.#Signin & {
	signin: {
		broker:    "https://id.bonisoft3.com"
		providers: ["google", "email"]
	}
}
