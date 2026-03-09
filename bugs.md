# Bugs


## reconnect not working

when a player refreshes the page, they do now successfully see "reconnecting..." but they don't actually reconnect to the game. we want their screen to load back to the state it was in before they refreshed, and we want them to be able to continue playing without any issues.

update: I'm seeing "reconnect success" on my server, but the client stays stuck until it times out back to the lobby.

## the trade section is labeled with "Maritime Trade"

maritime trade is just one type of trade in the game, and it would be more accurate to label this section as "Trade" or "Trading". this also reminds me that I haven't tested maritime trade at all yet, but I haven't noticed a way to do it in the UI.

## invalid trade error only shows up when typing in a wrong number, not when using the increment/decrement buttons

when I type in a number that is too high for the trade, I get an error message that says "max N". however, if I use the increment button to increase the number, it just won't let me increase it past the maximum, but it doesn't give me any feedback as to why. it would be helpful if the message popped up in both cases.

## The disabled buttons (when you don't have resources to build) are impossible to see

it just makes it look like there's text there, not a disabled button. we want it to be clear that it is a button, but that it is disabled.

